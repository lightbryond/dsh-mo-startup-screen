/* ============================================================================
 * 音频格式解析（check-audio.mjs / fix-audio.mjs 共用）
 * ----------------------------------------------------------------------------
 * 只做一件事：判断一个音频文件在浏览器里能不能被 decodeAudioData 解出来。
 * 重点识别"游戏原版语音"最常踩的坑：IMA / MS ADPCM 编码的 .wav ——
 * Chrome / Edge 解不出来，插件会静默（不会用 TTS 冒充），听感就是"这段没声音"。
 * ========================================================================== */
import fs from 'node:fs'

/** codec id → { name, ok }；ok=false 表示浏览器基本解不出来 */
export const CODECS = {
  0x0001: { name: 'PCM', ok: true },
  0x0003: { name: 'IEEE float', ok: true },
  0x0006: { name: 'A-law', ok: true },
  0x0007: { name: 'µ-law', ok: true },
  0x0002: { name: 'MS ADPCM', ok: false },
  0x0011: { name: 'IMA ADPCM', ok: false },
  0x0016: { name: 'DVI/ITU ADPCM', ok: false },
  0x0017: { name: 'DVI ADPCM', ok: false },
  0x0055: { name: 'MPEG Layer-3', ok: true },
  0xfffe: { name: 'WAVE_FORMAT_EXTENSIBLE', ok: 'ext' }
}

/** 解析 WAV 头；非 WAV 返回 { error } */
export function parseWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return { error: '不是 RIFF/WAVE 文件' }
  }
  let i = 12
  let fmt = null
  let dataSize = 0
  let factSamples = 0
  while (i + 8 <= buf.length) {
    const id = buf.toString('ascii', i, i + 4)
    const size = buf.readUInt32LE(i + 4)
    const body = i + 8
    if (id === 'fmt ' && size >= 16) {
      fmt = {
        codec: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        byteRate: buf.readUInt32LE(body + 8),
        bits: buf.readUInt16LE(body + 14),
        extCodec: size >= 40 ? buf.readUInt16LE(body + 24) : 0
      }
    } else if (id === 'data') {
      dataSize = size
    } else if (id === 'fact' && size >= 4) {
      factSamples = buf.readUInt32LE(body)
    }
    i = body + size + (size % 2)
  }
  if (!fmt) return { error: '缺少 fmt 块' }

  let codec = fmt.codec
  if (codec === 0xfffe && fmt.extCodec) codec = fmt.extCodec
  const meta = CODECS[codec] || { name: '未知 codec 0x' + codec.toString(16), ok: false }

  let duration = 0
  if (codec === 0x0001 || codec === 0x0003) {
    const frame = fmt.channels * (fmt.bits / 8)
    duration = frame > 0 ? dataSize / (fmt.sampleRate * frame) : 0
  } else if (factSamples && fmt.sampleRate) {
    duration = factSamples / fmt.sampleRate
  } else if (fmt.byteRate) {
    duration = dataSize / fmt.byteRate
  }

  let decodable = meta.ok === true
  let note = ''
  if (meta.ok === 'ext') { decodable = false; note = 'EXTENSIBLE 头且子编码未知' }
  if (decodable && fmt.bits === 8 && codec === 0x0001) note = '8-bit PCM（可播，音量偏小）'
  if (decodable && fmt.sampleRate && fmt.sampleRate < 8000) note = '采样率偏低'

  return {
    codec, codecName: meta.name, decodable, note,
    channels: fmt.channels, sampleRate: fmt.sampleRate, bits: fmt.bits,
    byteRate: fmt.byteRate, duration
  }
}

/** 读文件并给出结论：{ ok, kind, detail } */
export function inspectAudioFile(file) {
  const buf = fs.readFileSync(file)
  if (/\.mp3$/i.test(file)) {
    return { ok: true, kind: 'MP3', detail: (buf.length / 1024).toFixed(0) + ' KB · MP3 可直接解码', bytes: buf.length }
  }
  const info = parseWav(buf)
  if (info.error) return { ok: false, kind: '异常', detail: info.error, bytes: buf.length }
  const detail = info.codecName + ' · ' + info.channels + 'ch ' + info.sampleRate + 'Hz ' + info.bits + 'bit · ' +
    info.duration.toFixed(2) + 's · ' + (buf.length / 1024).toFixed(0) + ' KB' + (info.note ? ' · ' + info.note : '')
  return { ok: info.decodable, kind: info.decodable ? '正常' : '需转码', detail, bytes: buf.length, info }
}
