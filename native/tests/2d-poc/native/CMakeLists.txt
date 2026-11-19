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
get_filename_component(CC2D_REPLACEMENT_FONT "${CMAKE_CURRENT_LIST_DIR}/../../../../editor/assets/default_fonts/builtin-freetype/OpenSans-Regular.ttf" ABSOLUTE)
target_compile_definitions(cc2d_native_poc PRIVATE CC2D_FONT_FIXTURE="${CC2D_FONT_FIXTURE}" CC2D_REPLACEMENT_FONT="${CC2D_REPLACEMENT_FONT}")
target_link_libraries(cc2d_native_poc PRIVATE cocos_engine)
if(WIN32)
    target_sources(cc2d_native_poc PRIVATE font_alias_test.cpp)
    add_executable(cc2d_gdi_draw_profile EXCLUDE_FROM_ALL ../m6-gdi-draw-profile.cpp)
    target_link_libraries(cc2d_gdi_draw_profile PRIVATE cocos_engine)
    add_executable(cc2d_font_resource ../test_win_font_resource.cpp)
    target_link_libraries(cc2d_font_resource PRIVATE dwrite gdi32 user32)
    add_executable(cc2d_ttf_raster ../test_ttf_raster.cpp)
    target_link_libraries(cc2d_ttf_raster PRIVATE cocos_engine)
    add_executable(cc2d_ttf_stroke_freetype EXCLUDE_FROM_ALL ../test_ttf_freetype_stroke.cpp)
    target_link_libraries(cc2d_ttf_stroke_freetype PRIVATE cocos_engine)
    # Build outline diagnostics from source copies to keep test switches out of the engine.
    find_program(CC2D_NODE_EXECUTABLE NAMES node REQUIRED)
    set(CC2D_GEOMETRY_SOURCE "${CMAKE_CURRENT_BINARY_DIR}/ttf-geometry/DirectWriteFont-geometry.cpp")
    add_custom_command(OUTPUT "${CC2D_GEOMETRY_SOURCE}"
        COMMAND "${CC2D_NODE_EXECUTABLE}" "${CMAKE_CURRENT_LIST_DIR}/../build-ttf-geometry-probe.cjs" "${CMAKE_CURRENT_BINARY_DIR}/ttf-geometry"
        DEPENDS "${CMAKE_CURRENT_LIST_DIR}/../build-ttf-geometry-probe.cjs"
                "${CMAKE_CURRENT_LIST_DIR}/../../../cocos/platform/win32/modules/DirectWriteFont.cpp"
        VERBATIM)
    set(CC2D_DESIGN_SOURCE "${CMAKE_CURRENT_BINARY_DIR}/ttf-geometry/DirectWriteFont-design-units.cpp")
    add_custom_command(OUTPUT "${CC2D_DESIGN_SOURCE}"
        COMMAND "${CC2D_NODE_EXECUTABLE}" "${CMAKE_CURRENT_LIST_DIR}/../build-ttf-geometry-probe.cjs" "${CMAKE_CURRENT_BINARY_DIR}/ttf-geometry" --design-units
        DEPENDS "${CMAKE_CURRENT_LIST_DIR}/../build-ttf-geometry-probe.cjs"
                "${CMAKE_CURRENT_LIST_DIR}/../../../cocos/platform/win32/modules/DirectWriteFont.cpp"
        VERBATIM)
    set(CC2D_STROKE_SOURCE "${CMAKE_CURRENT_BINARY_DIR}/ttf-geometry/DirectWriteFont-stroke-replay.cpp")
    add_custom_command(OUTPUT "${CC2D_STROKE_SOURCE}"
        COMMAND "${CC2D_NODE_EXECUTABLE}" "${CMAKE_CURRENT_LIST_DIR}/../build-ttf-geometry-probe.cjs" "${CMAKE_CURRENT_BINARY_DIR}/ttf-geometry" --stroke-replay
        DEPENDS "${CMAKE_CURRENT_LIST_DIR}/../build-ttf-geometry-probe.cjs"
                "${CMAKE_CURRENT_LIST_DIR}/../../../cocos/platform/win32/modules/DirectWriteFont.cpp"
        VERBATIM)
    foreach(CC2D_VARIANT IN ITEMS geometry geometry_filtered design_units stroke_replay)
        if(CC2D_VARIANT STREQUAL design_units)
            set(variant_source "${CC2D_DESIGN_SOURCE}")
        elseif(CC2D_VARIANT STREQUAL stroke_replay)
            set(variant_source "${CC2D_STROKE_SOURCE}")
        else()
            set(variant_source "${CC2D_GEOMETRY_SOURCE}")
        endif()
        add_executable(cc2d_ttf_${CC2D_VARIANT} EXCLUDE_FROM_ALL ../test_ttf_raster.cpp "${variant_source}")
        target_include_directories(cc2d_ttf_${CC2D_VARIANT} PRIVATE "${CMAKE_CURRENT_LIST_DIR}/../../../cocos" "${CMAKE_CURRENT_LIST_DIR}/..")
        target_compile_definitions(cc2d_ttf_${CC2D_VARIANT} PRIVATE NOMINMAX CC2D_TTF_GEOMETRY_FILTERED=$<STREQUAL:${CC2D_VARIANT},geometry_filtered>)
        target_link_libraries(cc2d_ttf_${CC2D_VARIANT} PRIVATE dwrite d2d1 ole32 windowscodecs)
    endforeach()
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
