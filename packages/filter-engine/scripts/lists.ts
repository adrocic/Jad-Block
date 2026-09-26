/**
 * Filter lists shipped with the extension. Snapshots live in ../lists/ and are committed so builds
 * are reproducible (store reviewers must be able to rebuild the exact package).
 * EasyList and EasyPrivacy are dual-licensed GPLv3 / CC BY-SA 3.0: https://easylist.to/pages/licence.html
 */
export const LISTS = [
  { id: "easylist", url: "https://easylist.to/easylist/easylist.txt" },
  { id: "easyprivacy", url: "https://easylist.to/easylist/easyprivacy.txt" },
] as const;
