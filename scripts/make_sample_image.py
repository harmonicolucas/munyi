"""Create an original synthetic flood photo for the demo. It is not a field photograph."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "samples" / "rua-inundada.png"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (960, 600), "#d7e4ea")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 960, 220), fill="#9ec9d6")
    draw.rectangle((40, 150, 200, 360), fill="#d7c4a3")
    draw.rectangle((230, 120, 430, 360), fill="#c8b18d")
    draw.rectangle((500, 160, 700, 360), fill="#ddcbb0")
    draw.rectangle((760, 180, 930, 360), fill="#c9b89a")
    draw.polygon([(0, 360), (960, 340), (960, 600), (0, 600)], fill="#6f7c84")
    draw.polygon([(0, 430), (960, 400), (960, 560), (0, 590)], fill="#1d6f93")
    draw.polygon([(80, 470), (250, 455), (300, 500), (120, 520)], fill="#0e4f6b")
    draw.rectangle((620, 430, 760, 500), fill="#24343c")
    draw.rectangle((150, 250, 190, 360), fill="#8fb8c4")
    draw.rectangle((560, 230, 640, 360), fill="#8fb8c4")
    label = "IMAGEM SINTETICA DE TESTE — NAO E UMA FOTOGRAFIA"
    draw.rectangle((24, 24, 760, 64), fill="#07131a")
    draw.text((36, 34), label, fill="#f4f1ea")
    image.save(OUT, format="PNG")
    print(OUT)


if __name__ == "__main__":
    main()
