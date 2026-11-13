import { ImageResponse } from 'next/og';

// No existing favicon asset in the repo (no public/ dir) to reuse. The site
// itself has no brand color -- app/global.css's --primary is plain
// grayscale (shadcn's default neutral theme) -- so this matches that rather
// than inventing a new hue nothing else in the app uses.
// Required for `output: export` (see next.config.mjs) -- otherwise the
// build fails collecting page data for this route.
export const revalidate = false;
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          borderRadius: 6,
          color: '#fff',
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        G
      </div>
    ),
    size,
  );
}
