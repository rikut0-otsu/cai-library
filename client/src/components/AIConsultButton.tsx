import { type MouseEventHandler, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

type AIConsultButtonProps = {
  iconNormal: string;
  iconHeart: string;
  label?: string;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  className?: string;
};

export function AIConsultButton({
  iconNormal,
  iconHeart,
  label = "AIに相談する",
  href,
  target,
  rel,
  onClick,
  className,
}: AIConsultButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const normal = new Image();
    const heart = new Image();
    let loaded = 0;
    let failed = false;

    const done = () => {
      loaded += 1;
      if (loaded === 2 && !cancelled) {
        setIconsReady(!failed);
      }
    };

    normal.onload = done;
    normal.onerror = () => {
      failed = true;
      done();
    };
    heart.onload = done;
    heart.onerror = () => {
      failed = true;
      done();
    };
    normal.src = iconNormal;
    heart.src = iconHeart;

    return () => {
      cancelled = true;
    };
  }, [iconNormal, iconHeart]);

  const rootClassName = [
    "flex items-center gap-2 px-5 py-2.5 text-foreground hover:bg-muted rounded-full transition-colors",
    className ?? "",
  ]
    .join(" ")
    .trim();

  const iconNode = iconsReady ? (
    <span
      className={`relative inline-block h-7 w-7 shrink-0 transition-transform duration-200 ${
        hovered ? "scale-110" : "scale-100"
      }`}
      aria-hidden
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <img
        src={iconNormal}
        alt=""
        className={`absolute inset-0 h-7 w-7 object-contain transition-opacity duration-200 ${
          hovered ? "opacity-0" : "opacity-100"
        }`}
        draggable={false}
      />
      <img
        src={iconHeart}
        alt=""
        className={`absolute inset-0 h-7 w-7 object-contain transition-opacity duration-200 ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
        draggable={false}
      />
    </span>
  ) : (
    <MessageCircle
      className={`w-6 h-6 shrink-0 transition-transform duration-200 ${
        hovered ? "scale-110" : "scale-100"
      }`}
      aria-hidden
    />
  );

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      onClick={onClick}
      className={rootClassName}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {iconNode}
      <span className="text-sm font-medium">{label}</span>
    </a>
  );
}
