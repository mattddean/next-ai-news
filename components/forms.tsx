export function ErrorMessage({ errors }: { errors: string[] }) {
  return (
    <div className="flex flex-col sm:flex-row sm:space-y-0 sm:space-x-4 items-start">
      <div className="w-16" />
      <div className="mt-1 text-md text-red-500">
        {errors.map((error) => (
          <div key={error}>{error}</div>
        ))}
      </div>
    </div>
  );
}
