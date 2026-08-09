export async function lazyImport<T>(moduleName: string, installHint?: string): Promise<T> {
  try {
    return (await import(moduleName)) as T;
  } catch {
    throw new Error(
      `Missing optional dependency "${moduleName}". Install it with: npm install ${installHint ?? moduleName}`
    );
  }
}