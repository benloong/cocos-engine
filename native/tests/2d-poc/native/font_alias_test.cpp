// Compile the Windows binding into the test executable to inspect private registry
// counts across release and script cleanup without adding engine APIs.
#include "../../../cocos/bindings/manual/jsb_platform_win32.cpp"

size_t getFontAliasLeaseCount() { return fontAliasLeases.size(); }
size_t getFontAliasGroupCount() { return fontAliasGroups.size(); }
