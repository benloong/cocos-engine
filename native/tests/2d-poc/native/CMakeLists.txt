cmake_minimum_required(VERSION 3.20)
project(cc_2d_native_poc LANGUAGES CXX C ASM)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CC_USE_SCRIPT_ENGINE ON)
set(USE_MODULES OFF)

# Build the real engine static library and link a tiny console smoke test
# against it. Requires native/external (v4.0.0-10).
include(${CMAKE_CURRENT_LIST_DIR}/../../../CMakeLists.txt)

add_executable(cc2d_native_poc main.cpp)
get_filename_component(CC2D_FONT_FIXTURE "${CMAKE_CURRENT_LIST_DIR}/../../../../tests/fixtures/Thonburi.ttf" ABSOLUTE)
target_compile_definitions(cc2d_native_poc PRIVATE CC2D_FONT_FIXTURE="${CC2D_FONT_FIXTURE}")
target_link_libraries(cc2d_native_poc PRIVATE cocos_engine)
if(WIN32)
    add_executable(cc2d_font_resource ../test_win_font_resource.cpp)
    target_link_libraries(cc2d_font_resource PRIVATE dwrite gdi32 user32)
    add_executable(cc2d_ttf_raster ../test_ttf_raster.cpp)
    target_link_libraries(cc2d_ttf_raster PRIVATE cocos_engine)
endif()

# Use the production compiler/library for the complete Web parser parity corpus.
add_executable(cc2d_richtext_parser ../test_richtext_parser.cpp)
target_link_libraries(cc2d_richtext_parser PRIVATE cocos_engine)
add_executable(cc2d_richtext_layout ../test_richtext_layout.cpp)
target_link_libraries(cc2d_richtext_layout PRIVATE cocos_engine)
add_executable(cc2d_graphics_geometry ../test_graphics_geometry.cpp)
target_link_libraries(cc2d_graphics_geometry PRIVATE cocos_engine)

if(MSVC)
    foreach(item ${WINDOWS_DLLS})
        get_filename_component(filename ${item} NAME)
        get_filename_component(abs ${item} ABSOLUTE)
        add_custom_command(TARGET cc2d_native_poc POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different ${abs} $<TARGET_FILE_DIR:cc2d_native_poc>/${filename}
        )
    endforeach()
    foreach(item ${V8_DLLS})
        get_filename_component(filename ${item} NAME)
        add_custom_command(TARGET cc2d_native_poc POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different ${V8_DIR}/$<IF:$<BOOL:$<CONFIG:RELEASE>>,Release,Debug>/${filename} $<TARGET_FILE_DIR:cc2d_native_poc>/${filename}
        )
    endforeach()
endif()
