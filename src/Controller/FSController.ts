import rlp from 'node:readline/promises';
import fsp from 'node:fs/promises';

export type FSControllerType<T> = {
  run(source: string, destination: string, options: T): void;
};

export type FSAttributes = {
  rl: rlp.Interface;
  fs: typeof fsp;
};

export class FSController implements FSAttributes {
  public rl;
  public fs;

  constructor() {
    this.rl = rlp.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.fs = fsp;
  }
}
