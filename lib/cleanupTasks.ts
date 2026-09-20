export type CleanupTask = {
  name: string;
  run: () => Promise<boolean>;
};

export async function runIndependentCleanups(tasks: CleanupTask[]): Promise<string[]> {
  const failures: string[] = [];
  for (const task of tasks) {
    let succeeded = false;
    try {
      succeeded = await task.run();
    } catch {
      succeeded = false;
    }
    if (!succeeded) failures.push(task.name);
  }
  return failures;
}