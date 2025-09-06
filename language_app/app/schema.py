from pydantic import BaseModel


class InputText(BaseModel):
    text: str
    src_lang: str = "en_XX"
    tgt_lang: str = "de_DE"


class InsertText(BaseModel):
    text: str
    lang: str  # <-- added this
