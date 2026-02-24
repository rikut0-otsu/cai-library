export const onRequest = (context: { next: () => Promise<Response> }) => {
  return context.next();
};
