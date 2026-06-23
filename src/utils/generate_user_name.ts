const wordBank = [
	"happy",
	"cool",
	"fast",
	"blue",
	"cat",
	"fox",
	"lion",
	"coder",
];

const randomItem = <T>(arr: T[]): T | string => {
	return arr[Math.floor(Math.random() * arr.length)]!;
};

const getRandomWord = async (): Promise<string> => {
	const url = Bun.env.WORD_BANK_URL!;

	const res = await fetch(url);

	if (res.status >= 400) {
		console.error("Error occured fetching word bank");
		return randomItem(wordBank);
	}
	const data = await res.text();

	const arr = data.split("\n");

	const val = randomItem(arr);

	return val;
};

export const generateUserName = async () => {
	let word = await getRandomWord();

	const username = `${word}${Math.floor(1000 + Math.random() * 9000)}`;

	return username;
};
