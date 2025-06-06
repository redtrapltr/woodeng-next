import fs from "fs";
import bs58 from "bs58";

// Read your keypair file (adjust the path if necessary)
const secret = JSON.parse(fs.readFileSync("./scripts/mykeypair.json", "utf8"));

// Convert the JSON array into a Uint8Array and then to a base58 string
const base58Key = bs58.encode(new Uint8Array(secret));
console.log("Base58 Private Key:", base58Key);
