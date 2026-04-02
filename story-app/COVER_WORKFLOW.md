# Story Sonnet Cover Workflow

## Simple workflow
For any story series, drop a raw image into that story's folder under:

`public/covers/<story-slug>/`

Example:
- `public/covers/blocky-explores-mine-world/my-new-cover.png`
- `public/covers/pip-and-the-moonlight-mailbox/blocky-draft.jpg`

The watcher will:
1. detect the new image
2. convert it to `cover.webp`
3. overwrite the live site cover for that series

Because the app already points at `cover.webp`, the homepage tile and story page cover will update automatically.

## Notes
- Supported drop-in formats: `.png`, `.jpg`, `.jpeg`, `.webp`
- The watcher ignores files already named `cover.webp`
- Best results still come from creating covers in the intended 4:5 format

## Run watcher
```bash
node /mnt/synology/Story-Sonnet/story-app/scripts/watch-covers.cjs
```
