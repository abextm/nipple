echo "" > "$1.out"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
node -r "$DIR/nipple.js" -p "$(cat "$1")" &> "$1.out"