export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ContainerOptions {
  image?: string;
  testName?: string;
}

export interface Container {
  id: string;
  destroy(): Promise<void>;
  exec(command: string): Promise<ExecResult>;
  execOrThrow(command: string): Promise<ExecResult>;
  login(): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}

export type Engine = 'docker' | 'podman';
