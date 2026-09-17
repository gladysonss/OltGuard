/**
 * O serial da ONU chega na trap como OCTET STRING(SIZE(16)) - 16 caracteres
 * ASCII de digitos hexadecimais (ex: "54504C472D01EF28"), nao os 8 bytes
 * binarios em si. O padrao GPON (ITU-T G.984) e 4 bytes de ID do fabricante
 * (os primeiros 8 hex chars, decodificados como ASCII) + 4 bytes de numero
 * de serie (os ultimos 8 hex chars, mantidos como hex) - ex: "TPLG2D01EF28".
 */
export function formatOnuSerialNumber(raw: string): string {
  const hex = raw.trim();
  if (!/^[0-9A-Fa-f]{16}$/.test(hex)) {
    return hex;
  }

  const vendorHex = hex.slice(0, 8);
  const serialHex = hex.slice(8);

  let vendorId = '';
  for (let i = 0; i < vendorHex.length; i += 2) {
    vendorId += String.fromCharCode(parseInt(vendorHex.slice(i, i + 2), 16));
  }

  return `${vendorId}${serialHex.toUpperCase()}`;
}
