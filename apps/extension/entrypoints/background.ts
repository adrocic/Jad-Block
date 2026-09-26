export default defineBackground(() => {
  // M2: batch candidates from content scripts and call the classify API.
  // Any failure must degrade silently to DNR + cosmetic + cached decisions.
});
