async function wordIsValid(word: string): Promise<boolean> {
    if (word.length < 1) return false;
    return (await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)).status === 200;
}

export default wordIsValid;