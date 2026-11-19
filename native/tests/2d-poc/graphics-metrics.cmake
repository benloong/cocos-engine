# Test-only source copies for a Windows GLES3 application configured with
# -DCMAKE_PROJECT_INCLUDE=<absolute path to this file>.
include_guard(GLOBAL)
if(CMAKE_CURRENT_SOURCE_DIR STREQUAL CMAKE_SOURCE_DIR)
    cmake_language(DEFER CALL install_graphics_metrics)
endif()

function(install_graphics_metrics)
    get_target_property(sources cocos_engine SOURCES)
    set(output "${CMAKE_BINARY_DIR}/m6-graphics-metrics")
    file(MAKE_DIRECTORY "${output}")
    foreach(file IN ITEMS Batcher2d.cpp GLES3Commands.cpp GLES3Queue.cpp jsb_global.cpp)
        set(matches "${sources}")
        list(FILTER matches INCLUDE REGEX "/${file}$")
        list(LENGTH matches count)
        if(NOT count EQUAL 1)
            message(FATAL_ERROR "Expected exactly one ${file} in cocos_engine")
        endif()
        get_filename_component(includes "${matches}" DIRECTORY)
        set(copy "${output}/${file}")
        find_program(node node REQUIRED)
        add_custom_command(OUTPUT "${copy}"
            COMMAND "${node}" "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/instrument-graphics-metrics.cjs" "${matches}" "${copy}"
            DEPENDS "${matches}" "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/instrument-graphics-metrics.cjs"
            VERBATIM)
        set_source_files_properties("${copy}" TARGET_DIRECTORY cocos_engine PROPERTIES INCLUDE_DIRECTORIES "${includes}")
        list(REMOVE_ITEM sources "${matches}")
        list(APPEND sources "${copy}")
    endforeach()
    set_property(TARGET cocos_engine PROPERTY SOURCES "${sources}")
endfunction()
