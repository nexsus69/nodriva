# Lock amministrativi

Il lock è acquisito dal backend con sessione, attore, scope e `rowVersion`
espliciti. Il client mostra il proprietario e la scadenza, rinnova solo durante
attività umana e rilascia il lock al salvataggio o all'uscita.

La scadenza, il heartbeat e il TTL derivano da un'unica policy temporale. Un
conflitto restituisce un errore semantico senza sovrascrivere la bozza locale;
la UI deve consentire il recupero o l'abbandono esplicito delle modifiche.
