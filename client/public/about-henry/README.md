# About Henry — static assets

Photos referenced by `client/src/pages/AboutHenry.tsx` live in this folder and
are served by Vite at `/about-henry/<filename>`.

## Expected files

- `henry-and-friends.jpg` — group photo, Henry center. Referenced from the
  `<figure>` near the top of the article. If you swap the filename, also
  update the `<img src="…">` in `AboutHenry.tsx`.

## Adding more photos

Drop the file in this folder, then add another `<figure>` block in
`AboutHenry.tsx`:

```tsx
<figure className="flex flex-col gap-2">
  <img src="/about-henry/<filename>" alt="…" className="w-full rounded-sm border border-ink-700 object-cover" loading="lazy" />
  <figcaption className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
    Caption text
  </figcaption>
</figure>
```
