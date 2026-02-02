---
name: poe-generate
description: 'Poe code generation skill'
---

# poe-code generate

Use `poe-code generate` to create text, images, audio, or video via the Poe API.

## Text generation

```bash
poe-code generate "Write a short function that parses a JSON string safely."
```

Specify the model/bot:

```bash
# CLI option
poe-code generate --model "gpt-4.1" "Summarize this codebase change."

# Some agent runtimes call the model selector `--bot`
poe-code generate --bot "gpt-4.1" "Summarize this codebase change."
```

## Media generation

The CLI supports media generation as subcommands:

```bash
poe-code generate image "A 3D render of a rubber duck wearing sunglasses" --model "gpt-image-1" -o duck.png
poe-code generate video "A cinematic timelapse of a city at night" --model "veo" -o city.mp4
poe-code generate audio "A calm 10 second lo-fi beat" --model "audio-model" -o beat.wav
```

Some agent runtimes expose the same media types as flags. If available, these are equivalent:

```bash
poe-code generate --image "A 3D render of a rubber duck wearing sunglasses" --bot "gpt-image-1" -o duck.png
poe-code generate --video "A cinematic timelapse of a city at night" --bot "veo" -o city.mp4
poe-code generate --audio "A calm 10 second lo-fi beat" --bot "audio-model" -o beat.wav
```

## Tips

- Use `--param key=value` to pass provider/model parameters (repeatable).
- Use `--output <path>` (or `-o`) for media outputs.
