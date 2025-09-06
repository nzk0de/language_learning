from transformers import MBart50TokenizerFast, MBartForConditionalGeneration


class Translator:
    def __init__(self):
        model_name = "facebook/mbart-large-50-many-to-many-mmt"
        self.tokenizer = MBart50TokenizerFast.from_pretrained(model_name)
        self.model = MBartForConditionalGeneration.from_pretrained(model_name).to("cuda")
        self.lang_codes = set(self.tokenizer.lang_code_to_id.keys())

    def translate(self, text: str, src_lang: str, tgt_lang: str) -> str:
        self.tokenizer.src_lang = src_lang
        inputs = self.tokenizer(text, return_tensors="pt")
        inputs = {k: v.to("cuda") for k, v in inputs.items()}
        generated = self.model.generate(
            **inputs,
            forced_bos_token_id=self.tokenizer.lang_code_to_id[tgt_lang],
        )
        return self.tokenizer.batch_decode(generated, skip_special_tokens=True)[0]
