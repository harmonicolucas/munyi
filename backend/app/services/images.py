import io

from PIL import Image, UnidentifiedImageError

MAX_BYTES = 8 * 1024 * 1024
MAX_EDGE = 1600


class ImageRejected(Exception):
    pass


def prepare_image(raw: bytes) -> tuple[bytes, str, int, int]:
    if len(raw) > MAX_BYTES:
        raise ImageRejected("A imagem passa de 8 MB.")
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageRejected("O ficheiro não é uma imagem válida.") from exc
    if image.width * image.height > 12_000_000:
        raise ImageRejected("A imagem é demasiado grande.")
    image = image.convert("RGB")
    image.thumbnail((MAX_EDGE, MAX_EDGE))
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=82)
    return out.getvalue(), "image/jpeg", image.width, image.height
