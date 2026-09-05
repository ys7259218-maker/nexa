"use client";

import Image from "next/image";

interface AvatarProps {
  name?: string;
  image?: string;
  size?: number;
}

export default function Avatar({
  name = "N",
  image,
  size = 44,
}: AvatarProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        overflow: "hidden",
        background: "#27272A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 600,
        userSelect: "none",
      }}
    >
      {image ? (
        <Image
          src={image}
          alt={name}
          width={size}
          height={size}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}
