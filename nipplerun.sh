echo "" > "$1.out"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
# ` ;` is to fake out msys so it doesn't try to convert regexs as a posix path to a windows path
node -r "$DIR/nipple.js" -p " ;$(cat "$1")" &> "$1.out"