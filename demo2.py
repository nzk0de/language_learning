import bz2
import mwparserfromhell
import xml.etree.ElementTree as ET
i = 0
with bz2.open("/home/ubuntu/Downloads/dewiki-20250901-pages-articles-multistream1.xml-p1p297012.bz2") as f:
    for _, elem in ET.iterparse(f, events=("end",)):
        if elem.tag.endswith("title"):
            print(elem.text)
        if elem.tag.endswith("text"):
            title = elem.findtext(".//title")
            text = elem.findtext(".//revision/text")
            # if text:
            wikicode = mwparserfromhell.parse(elem.text)
            plain_text = wikicode.strip_code()
            #     print(title, plain_text[:200])  # preview first 200 chars
            # elem.clear()
            print(plain_text)
            break

