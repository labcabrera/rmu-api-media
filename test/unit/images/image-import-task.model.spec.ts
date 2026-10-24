describe('ImageImportTaskModel [F-media-04]', () => {
  it('keeps the errors field without the reserved-key warning of Mongoose', async () => {
    const warnings: string[] = [];
    const listener = (warning: Error) => warnings.push(warning.message);
    process.on('warning', listener);
    const { ImageImportTaskSchema } =
      await import('../../../src/modules/images/infrastructure/persistence/models/image-import-task.model.js');
    await new Promise(resolve => setImmediate(resolve));
    process.off('warning', listener);
    expect(ImageImportTaskSchema.path('errors')).toBeDefined();
    expect(warnings.filter(message => message.includes('errors'))).toEqual([]);
  });
});
