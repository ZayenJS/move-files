import { exit } from 'node:process';
import shelljs from 'shelljs';
import path from 'path';
import { FSController, FSControllerType } from './FSController';

type MoveOptions = {
  type: string; // e.g. .jpg, .png, .txt, etc.
  dry: boolean;
};

type MoveAttributes = {
  source: string;
  destination: string;
  options: MoveOptions;
};

export class FSMoveController extends FSController implements FSControllerType<MoveOptions>, MoveAttributes {
  public source: string = '';
  public destination: string = '';
  public options: MoveOptions = { dry: false, type: '*' };

  public run = async (source: string, destination: string, options: MoveOptions) => {
    this.source = source;
    this.destination = destination;
    this.options = options;

    const files = await this.getFilesForType(options.type);
    this.exitIfNoFiles(files);
    await this.handleDryRun(options.dry, files);
    await this.handleDestinationDoesNotExist();
    await this.moveFiles(files);

    console.info('Done');

    exit(0);
  };

  // TODO: refactor this to be more readable
  public runYear = async (source: string, destination: string, options: MoveOptions) => {
    this.source = source;
    this.destination = destination;
    this.options = options;

    const isDir = await this.isDirectory(this.source);

    if (!isDir) {
      console.info(`${this.source} is not a directory`);
      exit(0);
    }

    const filePaths = await this.findFilePathsByExtension(this.source);
    const result = filePaths.reduce((acc, filePath) => {
      const year = /\/(\d{4})\//.exec(filePath)?.[1];
      const month = /\/(\d{2})\//.exec(filePath)?.[1];

      let destinationPath = this.destination;

      if (year) {
        destinationPath += `/${year}`;
      }

      if (month) {
        destinationPath += `/${month}`;
      }

      acc[filePath] = `${destinationPath}/${path.basename(filePath)}`;

      return acc;
    }, {} as Record<string, string>);

    // const result = await this.getFilePaths(this.source);

    console.info('='.repeat(80));
    console.info(`Here are the files that ${options.dry ? 'would' : 'will'} be moved:`);

    for (const [source, destination] of Object.entries(result)) {
      console.info(`${source} => ${destination}`);
    }
    console.info('='.repeat(80));

    if (options.dry) {
      console.info('This is a dry run, nothing will be changed in the filesystem');
      exit(0);
    }

    const wantToProceed = await this.rl.question('Do you want to proceed? (y/n) ');

    if (wantToProceed !== 'y') {
      console.info('Aborting');
      exit(0);
    }

    for (const [source, destination] of Object.entries(result)) {
      const destinationFolder = destination.replace(/\/[^/]+$/, '');
      await this.handleDestinationDoesNotExist(destinationFolder);

      const destinationFileExists = Boolean(await this.fs.stat(destination).catch(() => false));

      if (destinationFileExists) {
        const answer = await this.rl.question(`File ${destination} already exists, overwrite? (y/n) `);

        if (answer !== 'y') {
          console.info(`Skipping ${destination}`);
          continue;
        }
      }

      try {
        shelljs.mv(source, destination);
        console.info(`Moved ${source} to ${destination}`);
      } catch (e) {
        console.info(`Could not move ${source} to ${destination}`);
        console.error(e);
        exit(1);
      }
    }

    console.info('Done');
    exit(0);
  };

  private async isDirectory(path: string) {
    return Boolean(
      await this.fs
        .stat(path)
        .then((el) => el.isDirectory())
        .catch(() => false),
    );
  }

  private async getFilePaths(path: string = '', result: Record<string, string> = {}): Promise<Record<string, string>> {
    console.info(`Getting files for ${path}`);

    const sourceDirContent = await this.fs.readdir(path ?? this.source);
    const files = sourceDirContent.filter((file) => file.endsWith(this.options.type));

    if (!files.length) {
      for (const dir of sourceDirContent) {
        const isDir = await this.isDirectory(`${path}/${dir}`);

        if (!isDir) {
          continue;
        }

        const f = await this.getFilePaths(`${path}/${dir}`);

        for (const [source, destination] of Object.entries(f)) {
          result[source] = destination;
        }
      }
    }

    const year = /\/(\d{4})\//.exec(path)?.[1];
    const month = /\/(\d{2})$/.exec(path)?.[1];

    for (const file of files) {
      let destinationPath = this.destination;

      if (year) {
        destinationPath += `/${year}`;
      }

      if (month) {
        destinationPath += `/${month}`;
      }

      result[`${path}/${file}`] = `${destinationPath}/${file}`;
    }

    return result;
  }

  async findFilePathsByExtension(directoryPath: string): Promise<string[]> {
    const fileExtension = this.options.type;
    try {
      const files = await this.fs.readdir(directoryPath);

      const filteredFiles = await Promise.all(
        files.map(async (file) => {
          // ignore @eaDir
          if (file.startsWith('@')) {
            return null;
          }
          const filePath = path.join(directoryPath, file);
          const fileStat = await this.fs.stat(filePath);

          if (fileStat.isFile() && path.extname(file) === `.${fileExtension}`) {
            return filePath;
          } else if (fileStat.isDirectory()) {
            // Recursive call for subdirectories
            return this.findFilePathsByExtension(filePath);
          } else {
            return null;
          }
        }),
      );

      // Flatten the array and filter out null values
      return filteredFiles.flat().filter((filePath) => filePath !== null) as string[];
    } catch (error) {
      console.error('Error reading directory:', (error as Error).message);
      throw error;
    }
  }

  private async getFilesForType(type: string) {
    const files = await this.fs.readdir(this.source);

    return files.filter((file) => file.endsWith(type));
  }

  private exitIfNoFiles(files: string[]) {
    if (files.length > 0) {
      return;
    }

    console.info(`No files found in ${this.source} for type ${this.options.type}`);
    exit(0);
  }

  private async handleDryRun(dryRun: boolean, files: string[]) {
    if (!dryRun) {
      return;
    }

    console.info('='.repeat(80));
    console.info('This is a dry run, nothing will be changed in the filesystem');
    console.info('='.repeat(80));
    console.info(`Here are the files that would be moved from ${this.source} to ${this.destination}:`);
    console.info(files);
    console.info();

    const destinationExists = Boolean(await this.fs.stat(this.destination).catch(() => false));

    if (!destinationExists) {
      console.info(`Destination folder ${this.destination} does not exist, it would be created if you want to proceed`);

      exit(0);
    }

    console.info(`Here are the files in the destination folder ${this.destination}:`);
    const destinationFiles = await this.fs.readdir(this.destination);
    console.info(destinationFiles);

    const filesThatWouldBeOverwritten = files.filter((file) => destinationFiles.includes(file));

    console.info(`The following files would be overwritten (if you want to proceed):`);
    console.info(filesThatWouldBeOverwritten);

    exit(0);
  }

  private async handleDestinationDoesNotExist(destination: string = '') {
    const destinationExists = Boolean(await this.fs.stat(destination ?? this.destination).catch(() => false));

    if (destinationExists) {
      return;
    }

    console.info();
    const answer = await this.rl.question(`Destination folder ${this.destination} does not exist, create it? (y/n) `);

    if (answer !== 'y') {
      console.info('Aborting');
      exit(0);
    }

    try {
      await this.fs.mkdir(this.destination, { recursive: true });
    } catch (e) {
      console.info(`Could not create ${this.destination}`);
      console.error(e);
      exit(1);
    }
  }

  private async moveFiles(files: string[]) {
    for (const file of files) {
      const destinationFileExists = await this.fs.stat(`${this.destination}/${file}`).catch(() => false);

      if (destinationFileExists) {
        const answer = await this.rl.question(
          `File ${file} already exists in destination folder (${this.destination}), overwrite? (y/n) `,
        );

        if (answer !== 'y') {
          console.info(`Skipping ${file}`);
          continue;
        }
      }

      try {
        shelljs.mv(`${this.source}/${file}`, `${this.destination}/${file}`);
        console.info(`Moved ${file} to ${this.destination}`);
      } catch (e) {
        console.info(`Could not move ${file} to ${this.destination}`);
        console.error(e);
        exit(1);
      }
    }
  }
}

export const fsMoveController = new FSMoveController();
