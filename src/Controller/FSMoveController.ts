import { exit } from 'node:process';
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

class FSMoveController extends FSController implements FSControllerType<MoveOptions>, MoveAttributes {
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

  private async handleDestinationDoesNotExist() {
    const destinationExists = Boolean(await this.fs.stat(this.destination).catch(() => false));

    if (destinationExists) {
      return;
    }

    const answer = await this.rl.question(`Destination folder ${this.destination} does not exist, create it? (y/n) `);

    if (answer !== 'y') {
      console.info('Aborting');
      exit(0);
    }

    await this.fs.mkdir(this.destination);
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

      await this.fs.rename(`${this.source}/${file}`, `${this.destination}/${file}`);
    }
  }
}

export const fsMoveController = new FSMoveController();
