export const sleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolveSleep) => {
    setTimeout(resolveSleep, milliseconds);
  });
};
