from pydantic import BaseModel


class InputText(BaseModel):
    text: str
    src_lang: str = "de"  # Updated to use simple language codes
    tgt_lang: str = "en"
