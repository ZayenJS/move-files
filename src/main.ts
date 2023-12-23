import { Command } from 'commander';
import { fsMoveController } from './Controller/FSMoveController';

const program = new Command();

program
  .version('1.0.0')
  .command('mv <source> <destination>')
  .requiredOption('-t, --type <type>', 'Type of file to move (e.g. .jpg, .png, .txt, etc.)')
  .option('-d, --dry', 'Dry run, do not move files but show what would be moved')
  .description('Move files from one directory to another')
  .action(fsMoveController.run);

program.parse(process.argv);
