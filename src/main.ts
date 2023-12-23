import { Command } from 'commander';
import { fsMoveController } from './Controller/FSMoveController';

const program = new Command();

program.version('1.0.0');

program
  .command('mv <source> <destination>')
  .requiredOption('-t, --type <type>', 'Type of file to move (e.g. .jpg, .png, .txt, etc.)')
  .option('-d, --dry', 'Dry run, do not move files but show what would be moved')
  .description('Move files from one directory to another')
  .action(fsMoveController.run);

program
  .command('mv-year <source> <destination>')
  .requiredOption('-t, --type <type>', 'Type of file to move (e.g. .jpg, .png, .txt, etc.)')
  .option('-d, --dry', 'Dry run, do not move files but show what would be moved')
  .description(
    'Source directory should contain year directories, which should contain month directories, which should contain files (e.g. 2021/01/1234.mp4)',
  )
  .action(fsMoveController.runYear);

program.parse(process.argv);
