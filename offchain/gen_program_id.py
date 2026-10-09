"""Generate a random valid base58 Solana program ID (32 bytes)."""
import os

ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58encode(b: bytes) -> str:
    n = int.from_bytes(b, "big")
    s = ""
    while n > 0:
        n, r = divmod(n, 58)
        s = ALPHABET[r] + s
    leading = 0
    for byte in b:
        if byte == 0:
            leading += 1
        else:
            break
    return "1" * leading + s


if __name__ == "__main__":
    print(b58encode(os.urandom(32)))
