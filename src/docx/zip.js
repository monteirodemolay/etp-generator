/**
 * Compactador ZIP, método "armazenado" (sem compressão).
 *
 * Um arquivo .docx é um pacote ZIP com XMLs dentro. Como o app não usa
 * biblioteca de compactação, o formato é escrito byte a byte aqui. Sem
 * compressão o arquivo fica maior, mas o código é curto e não depende de nada
 * externo — o que importa num sistema que precisa funcionar em qualquer
 * máquina da Prefeitura.
 */

// Tabela do CRC-32, calculada uma vez no carregamento
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function textoParaBytes(txt) {
  return new TextEncoder().encode(txt);
}

export function criarZip(arquivos) {
  const pedacos = [];
  const central = [];
  let deslocamento = 0;

  const num16 = n => [n & 0xFF, (n >>> 8) & 0xFF];
  const num32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

  arquivos.forEach(arq => {
    const nome = textoParaBytes(arq.nome);
    const dados = arq.dados;
    const crc = crc32(dados);

    const cabecalhoLocal = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04,       // assinatura
      20, 0, 0, 0, 0, 0,            // versão, flags, método (0 = armazenado)
      0, 0, 0, 0,                   // data/hora
      ...num32(crc), ...num32(dados.length), ...num32(dados.length),
      ...num16(nome.length), 0, 0,
      ...nome,
    ]);
    pedacos.push(cabecalhoLocal, dados);

    central.push(new Uint8Array([
      0x50, 0x4B, 0x01, 0x02,
      20, 0, 20, 0, 0, 0, 0, 0,
      0, 0, 0, 0,
      ...num32(crc), ...num32(dados.length), ...num32(dados.length),
      ...num16(nome.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ...num32(deslocamento),
      ...nome,
    ]));

    deslocamento += cabecalhoLocal.length + dados.length;
  });

  const tamanhoCentral = central.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, 0, 0, 0, 0,
    ...num16(arquivos.length), ...num16(arquivos.length),
    ...num32(tamanhoCentral), ...num32(deslocamento), 0, 0,
  ]);

  const total = [...pedacos, ...central, fim];
  const tamanho = total.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(tamanho);
  let pos = 0;
  total.forEach(p => { saida.set(p, pos); pos += p.length; });
  return saida;
}
