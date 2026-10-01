# Rotazione della cifratura

Le chiavi sono gestite dal secret manager e non dal repository. La rotazione
introduce una nuova chiave primaria, mantiene temporaneamente le precedenti per
la decifratura e re-cifra progressivamente i dati, registrando esito e versione.

Un errore di decifratura blocca la mutazione interessata senza perdere il dato;
backup e restore devono conservare il materiale necessario alla finestra di
rotazione secondo la policy di sicurezza.
