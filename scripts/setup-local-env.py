#!/usr/bin/env python3
"""Create private local backend settings without displaying credentials."""
import getpass
import os
from pathlib import Path
import secrets


def main():
    path = Path(__file__).resolve().parents[1] / '.env'
    if path.exists():
        raise SystemExit('.env already exists; left its credentials unchanged.')
    settings = {
        'JWT_SECRET': secrets.token_hex(32),
        'DB_URL': 'jdbc:postgresql://localhost:5432/productivity',
        'DB_USERNAME': getpass.getuser(),
        'DB_PASSWORD': '',
        'DEV_SEED_TEST_ACCOUNT': 'false',
        'DEV_TEST_ACCOUNT_PASSWORD': secrets.token_urlsafe(32),
    }
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as file:
        file.write('# Private local settings. Do not share or commit this file.\n')
        file.writelines(f'{key}={value}\n' for key, value in settings.items())
    print('Created private .env (owner read/write only). Check its database settings, then run ./mvnw spring-boot:run from the backend root.')


if __name__ == '__main__':
    main()
