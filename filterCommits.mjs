export default async (commits, context) => {
  return commits.filter(() => {
    // Check if the commit affects files in the test2doc-playwright package
    const affectedFiles = context.payload.commits.flatMap(
      (c) => c.modified || [],
    )
    return affectedFiles.some((file) =>
      file.startsWith("packages/test2doc-playwright/"),
    )
  })
}
