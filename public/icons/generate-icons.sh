#!/bin/bash

# Usage help
usage() {
    echo "Usage: $0 <source_file.png> [output_prefix]"
    echo "Example: $0 source.png icon => icon_64.png, icon_128.png, ..."
    exit 1
}

# Check for ImageMagick
if ! command -v convert &>/dev/null; then
    echo "Error: ImageMagick 'convert' command not found. Install it first."
    exit 2
fi

# Handle --help or missing args
[[ "$1" == "--help" || -z "$1" ]] && usage

# Check if input file exists
if [[ ! -f "$1" ]]; then
    echo "Error: Source file '$1' not found."
    usage
fi

src_file="$1"
prefix="${2:-output}"
# output_dir="./resized" # Optional: mkdir -p "$output_dir"

for size in 64 128 256 512 1024; do
    convert "$src_file" -resize ${size}x${size} "${prefix}_${size}x${size}.png"
	if [ $? == 0 ]; then echo "Done ${size}x${size}: $(du ${prefix}_${size}x${size}.png)"; fi;
    # OR: convert "$src_file" -resize ${size}x${size} "${output_dir}/${prefix}_${size}.png"
done

echo "Done. Exported sizes: 64–1024 px for $src_file"
