import torch
from transformers import MBart50TokenizerFast, MBartForConditionalGeneration


class Translator:
    def __init__(self):
        model_name = "facebook/mbart-large-50-many-to-many-mmt"
        self.tokenizer = MBart50TokenizerFast.from_pretrained(model_name)
        model = MBartForConditionalGeneration.from_pretrained(model_name).to(self._device)
        self.model = torch.compile(model)
        print("Translator initialized")
    @property
    def _device(self) -> torch.device:
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")

    @property
    def lang_codes(self) -> set:
        return set(self.tokenizer.lang_code_to_id.keys())

    def translate(self, text: str, src_lang: str, tgt_lang: str) -> str:
        self.tokenizer.src_lang = src_lang
        inputs = self.tokenizer(text, return_tensors="pt")
        inputs = {k: v.to(self._device) for k, v in inputs.items()}
        generated = self.model.generate(
            **inputs,
            forced_bos_token_id=self.tokenizer.lang_code_to_id[tgt_lang],
        )
        return self.tokenizer.batch_decode(generated, skip_special_tokens=True)[0]