import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-3xl font-extrabold">This page doesn't exist</h1>
        <Link to="/" className="mt-6 inline-block font-semibold text-brand-600 hover:underline">Go to your boards</Link>
      </div>
    </div>
  );
}
