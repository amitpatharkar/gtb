// Minimal streaming reader for OpenStreetMap Protocolbuffer Binary Format (.osm.pbf).
// Spec: https://wiki.openstreetmap.org/wiki/PBF_Format
// Only what the tile converter needs: node coordinates, way tags + node refs,
// relation tags + members. Info/metadata fields are skipped.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { PbfReader } from 'pbf';

const MEMBER_TYPES = ['node', 'way', 'relation'];

/**
 * Read every data block of an .osm.pbf file and call the handlers.
 * Leave a handler out to skip decoding that element type (much faster).
 * @param {string} file
 * Set `nodeTags: true` to also receive node tags (4th argument, null when untagged).
 * @param {{ node?: (id:number, lat:number, lon:number, tags?:object|null) => void,
 *           way?: (id:number, tags:object, refs:number[]) => void,
 *           relation?: (id:number, tags:object, members:{type:string, ref:number, role:string}[]) => void }} h
 */
export function readOsmPbf(file, h) {
  const buf = fs.readFileSync(file);
  let off = 0;
  while (off < buf.length) {
    const headerLen = buf.readUInt32BE(off);
    off += 4;
    const header = new PbfReader(buf.subarray(off, off + headerLen)).readFields(readBlobHeader, { type: '', datasize: 0 });
    off += headerLen;
    const blobBuf = buf.subarray(off, off + header.datasize);
    off += header.datasize;
    if (header.type !== 'OSMData') continue;
    const blob = new PbfReader(blobBuf).readFields(readBlob, {});
    let data;
    if (blob.raw) data = blob.raw;
    else if (blob.zlib) data = zlib.inflateSync(blob.zlib);
    else throw new Error('Unsupported blob compression (only raw and zlib are supported)');
    readPrimitiveBlock(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), h);
  }
}

function readBlobHeader(tag, o, pbf) {
  if (tag === 1) o.type = pbf.readString();
  else if (tag === 3) o.datasize = pbf.readVarint();
}

function readBlob(tag, o, pbf) {
  if (tag === 1) o.raw = pbf.readBytes();
  else if (tag === 3) o.zlib = pbf.readBytes();
}

const decoder = new TextDecoder();

function readPrimitiveBlock(data, h) {
  // First pass over the block: settings + string table. Groups are read after,
  // because granularity/offsets may appear after the groups in the stream.
  const pbf = new PbfReader(data);
  const block = { strings: null, stringBufs: [], granularity: 100, latOff: 0, lonOff: 0, groups: [] };
  pbf.readFields((tag, b, p) => {
    if (tag === 1) p.readMessage((t, bb, pp) => { if (t === 1) bb.stringBufs.push(pp.readBytes()); }, b);
    else if (tag === 2) { b.groups.push(p.pos); p.skip(p.type); }
    else if (tag === 17) b.granularity = p.readVarint();
    else if (tag === 19) b.latOff = p.readVarint(true);
    else if (tag === 20) b.lonOff = p.readVarint(true);
  }, block);
  const strings = () => block.strings || (block.strings = block.stringBufs.map((s) => decoder.decode(s)));
  for (const start of block.groups) {
    const g = new PbfReader(data);
    g.pos = start;
    g.readMessage((tag, _, p) => {
      if (tag === 2 && h.node) readDense(p, block, h.node, h.nodeTags ? strings : null);
      else if (tag === 1 && h.node) readNode(p, block, h.node);
      else if (tag === 3 && h.way) readWay(p, strings(), h.way);
      else if (tag === 4 && h.relation) readRelation(p, strings(), h.relation);
    }, null);
  }
}

/** Dense nodes. With `strings`, tags are decoded too (null for untagged nodes). */
function readDense(pbf, block, cb, strings) {
  const end = pbf.readVarint() + pbf.pos;
  let ids = [], lats = [], lons = [], kv = [];
  while (pbf.pos < end) {
    const tag = pbf.readVarint();
    const field = tag >>> 3;
    pbf.type = tag & 7;
    if (field === 1) ids = pbf.readPackedSVarint();
    else if (field === 8) lats = pbf.readPackedSVarint();
    else if (field === 9) lons = pbf.readPackedSVarint();
    else if (field === 10 && strings) kv = pbf.readPackedVarint();
    else pbf.skip(tag);
  }
  const { granularity: g, latOff, lonOff } = block;
  const st = strings ? strings() : null;
  let id = 0, lat = 0, lon = 0, k = 0;
  for (let i = 0; i < ids.length; i++) {
    id += ids[i]; lat += lats[i]; lon += lons[i];
    let tags = null;
    if (st && k < kv.length) {
      while (kv[k] !== 0 && k < kv.length) { (tags ||= {})[st[kv[k]]] = st[kv[k + 1]]; k += 2; }
      k++;
    }
    cb(id, 1e-9 * (latOff + g * lat), 1e-9 * (lonOff + g * lon), tags);
  }
}

function readNode(pbf, block, cb) {
  const n = pbf.readMessage((tag, o, p) => {
    if (tag === 1) o.id = p.readSVarint();
    else if (tag === 8) o.lat = p.readSVarint();
    else if (tag === 9) o.lon = p.readSVarint();
  }, { id: 0, lat: 0, lon: 0 });
  const { granularity: g, latOff, lonOff } = block;
  cb(n.id, 1e-9 * (latOff + g * n.lat), 1e-9 * (lonOff + g * n.lon));
}

function tagsFrom(keys, vals, strings) {
  const tags = {};
  for (let i = 0; i < keys.length; i++) tags[strings[keys[i]]] = strings[vals[i]];
  return tags;
}

function readWay(pbf, strings, cb) {
  const w = pbf.readMessage((tag, o, p) => {
    if (tag === 1) o.id = p.readVarint();
    else if (tag === 2) p.readPackedVarint(o.keys);
    else if (tag === 3) p.readPackedVarint(o.vals);
    else if (tag === 8) p.readPackedSVarint(o.refs);
  }, { id: 0, keys: [], vals: [], refs: [] });
  for (let i = 1; i < w.refs.length; i++) w.refs[i] += w.refs[i - 1];
  cb(w.id, tagsFrom(w.keys, w.vals, strings), w.refs);
}

function readRelation(pbf, strings, cb) {
  const r = pbf.readMessage((tag, o, p) => {
    if (tag === 1) o.id = p.readVarint();
    else if (tag === 2) p.readPackedVarint(o.keys);
    else if (tag === 3) p.readPackedVarint(o.vals);
    else if (tag === 8) p.readPackedVarint(o.roles);
    else if (tag === 9) p.readPackedSVarint(o.memids);
    else if (tag === 10) p.readPackedVarint(o.types);
  }, { id: 0, keys: [], vals: [], roles: [], memids: [], types: [] });
  const members = [];
  let ref = 0;
  for (let i = 0; i < r.memids.length; i++) {
    ref += r.memids[i];
    members.push({ type: MEMBER_TYPES[r.types[i]], ref, role: strings[r.roles[i]] });
  }
  cb(r.id, tagsFrom(r.keys, r.vals, strings), members);
}
