# Backend internationalization

Backend errors and catalog values expose stable technical codes plus localized
presentation data where appropriate. Authorization and validation never depend
on translated text. Unknown keys use an explicit fallback and are observable in
logs without leaking secrets.
