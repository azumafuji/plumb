
var default_dimensions = ["study_type", "overall_status", "phase" ];
var current_dimensions = ["study_type", "overall_status", "phase" ];

var min_height = 400

function chart_height(){
    var td = current_dimensions.length-1;
    if(min_height/td < 150) {
        return 150*td;
    } else {
        return min_height;
    }

}

function chart_width(){
    return 780;
}


var vis = d3.select("#vis").append("svg")
    .attr("width", chart_width())
    .attr("height", chart_height());

var chart = d3.parsets()
    .dimensions(default_dimensions)
    .tension(0.5)
    .on("sortDimensions", function(){reset_paths();})
    .on("sortCategories", function(){reset_paths();})
    .width(chart_width())
    .height(chart_height());


var meshtree_data = {};
var stopped_data = {};
var parset_data = new Array();
var ice = false;
var search_results_count = 0;
var filter_set = [[],[]];

// Initial URls
var base_url = "http://api.lillycoi.com/v1/trials/search?";
var data_fields = "fields=id,phase,brief_title,study_type,overall_status,eligibility,sponsors,condition,intervention_browse,condition_browse,has_expanded_access,is_fda_regulated,is_section_801";
var default_term = "\"tuberculosis\"";
var current_term = default_term;
var current_search = default_term + " [ALL-FIELDS]";
var data_query = "&query=count:999999,show_xprt:Y,xprt:" + current_search;
var data_url = base_url + data_fields + data_query;
var data_table = Object();

// Filtering Logic
$.fn.dataTableExt.afnFiltering.push(
    function( oSettings, aData, iDataIndex ) {
        var colIdx = new Array();
        colIdx["id"] = 0;
        colIdx["brief_title"] = 1;
        colIdx["study_type"] = 2;
        colIdx["overall_status"] = 3;
        colIdx["phase"] = 4;
        colIdx["gender"] = 5;
        colIdx["lead_agency_type"] = 6;
        colIdx["condition"] = 7;
        colIdx["intervention"] = 8;
        colIdx["why_stopped"] = 9;

        var return_row = true;

        for(i=0;i<filter_set[0].length;i++){
            var col = filter_set[0][i];
            var col_val = filter_set[1][i];
            var col_int = colIdx[col];


            if(col_int > 0){
                var data_val = aData[col_int];
                if(data_val != col_val){
                    return_row = false;
                }
            }

        }

        return return_row;
    });

$(document).ready(function () {

    load_mesh();
    load_stopped(true);
    $("#search_input").val(default_term);
    reset_dimensions();
    display_filters();
    update_datatable();

    var form = $("#search_form");
    form.submit(function(e) {
        e.preventDefault();
        search_ctgov();
    });

    var form = $("#facet_form");
    form.submit(function(e) {
        e.preventDefault();
        update_dimensions();
    });

});

function reset_dimensions(){
    $('.facet_check').each(function(){
        if($.inArray($(this).val(),current_dimensions) >= 0){
            $(this).attr('checked', true);
        } else {
            $(this).attr('checked', false);
        }
    });
}

function reset_filters(){
    filter_set = [[],[]];
    display_filters();
    data_table.fnDraw();

}

function display_filters(){
    $(".filter_item").remove();
    if(filter_set[0].length > 0){
        for(i=0;i<filter_set[0].length;i++){
            var col = filter_set[0][i];
            var col_val = filter_set[1][i];
            if(col){
                $("#filter_list").append("<li class='filter_item'>" + col + ": <strong>" + col_val + "</strong></li>");
            }
        }

    } else {
        $("#filter_list").append("<li class='filter_item'>None</li>");

    }

}

function update_dimensions(){
    var new_dimensions = [];
    $('.facet_check:checked').each(function(){
       new_dimensions.push($(this).val());
    });
    current_dimensions = new_dimensions;
    console.log(current_dimensions);

    $('#vis').slideUp(500);
    $('svg').fadeOut(300, function(){ $(this).remove();});

    chart = d3.parsets()
        .dimensions(current_dimensions)
        .width(chart_width())
        .on("sortDimensions", reset_paths())
        .on("sortCategories", reset_paths())
        .tension(0.6)
        .height(chart_height());

    vis = d3.select("#vis").append("svg")
        .attr("width", chart.width())
        .attr("height", chart.height());

    load_results();

    $('#vis').slideDown(1000);

}

function load_stopped(cached) {
    if (cached){
        url = 'js/data-stopped.json';
    } else {
        url = 'http://ec2-50-18-235-6.us-west-1.compute.amazonaws.com:8080/trials/stopped';
    }

    $.getJSON(url, function(data) {
        for(i=0;i<data.length;i++){

            stopped_data[data[i].id] = data[i]["why_stopped_classification"]["best-category"];
        }
    },'jsonp');
}

function load_mesh() {
    $.getJSON('js/data-meshtree.json', function(data) {
        meshtree_data = data;
    },'jsonp');
}

function mesh_lookup(term) {
    lookup = meshtree_data[term.toLowerCase()];
    if(!lookup) {
        lookup = 'N/A';
    }
    return lookup;
}

function update_datatable(){
    data_table = $('#detail_table').dataTable({
            "sDom":"<'row'<'span3'l><'span5'iT><'span4'f>r>t<'row'<'span12'p>",
            "sPaginationType":"bootstrap",
            "bProcessing": true,
            "sAjaxSource": data_url,
            "sAjaxDataProp": "results",

            "aoColumns": [
                { "mDataProp": "id", "sWidth": "10%" },
                { "mDataProp": "brief_title", "sWidth": "10%" },
                { "mDataProp": "study_type", "sWidth": "10%" },
                { "mDataProp": "overall_status", "sWidth": "10%"},
                { "mDataProp": "phase", "sWidth": "10%"},
                { "mDataProp": "gender", "sWidth": "10%" },
                { "mDataProp": "lead_agency_type", "sWidth": "10%" },
                { "mDataProp": "condition", "sWidth": "10%" },
                { "mDataProp": "intervention", "sWidth": "10%"},
                { "mDataProp": "why_stopped", "sWidth": "10%"}
            ],
            "sSwfPath": "/swf/copy_csv_xls_pdf.swf",
            "fnServerData": function( sUrl, aoData, fnCallback, oSettings ) {
                oSettings.jqXHR = $.ajax( {
                    "url": sUrl,
                    "data": "results",
                    "success": function(data) {
                        clean_api_data(data);
                        fnCallback(data);
                    },
                    "dataType": "jsonp",
                    "cache": false
                } ); }
        }
    );
    new FixedHeader( data_table, { "offsetTop": 40 });

}



function limit_option(limit) {
    return "&limit=" + limit;
}

function create_q(d) {
    var v = new Array();
    var a = new Array();
    v[1] = d.dimension
    a[1] = d.name
    var qs = 2

    var parent = d.parent
    while (parent.dimension) {
        v[qs] = parent.dimension;
        a[qs] = parent.name;
        parent = parent.parent;
        qs++;
    }
    return [v, a]

}

function create_cat_q(d){
    var v = new Array();
    var a = new Array();
    v[1] = d.dimension.name
    a[1] = d.name

    return [v, a]
}


function display_subset(d, i) {
    filter_set = create_q(d);
    display_filters();
    data_table.fnDraw();
}

function display_category(d, i) {
    filter_set = create_cat_q(d);
    display_filters();
    data_table.fnDraw();
}


function clean_api_data(data){
    for(var i=0;i<data.results.length;i++) {
        try {
            var intervention = mesh_lookup(data.results[i].intervention_browse.mesh_term[0]);
        } catch(err) {
            var intervention = "N/A";
        }
        try {
            var condition = mesh_lookup(data.results[i].condition_browse.mesh_term[0]);
        } catch(err) {
            var condition = "N/A"
        }
        try {
            var gender = data.results[i].eligibility.gender;
        } catch(err) {
            var gender = 'N/A'
        }
        try {
            var lead_agency_type = data.results[i].sponsors.lead_sponsor.agency_class;
        } catch(err) {
            var lead_agency_type = 'N/A'
        }

        delete data.results[i].sponsors
        delete data.results[i].eligibility

        var rid =  data.results[i].id
        data.results[i].id = "<a target='trial_detail' href='http://clinicaltrials.gov/ct2/show/" + rid + "'>" + rid + "</a>";
        data.results[i].intervention = intervention;
        data.results[i].condition = condition;
        data.results[i].gender = gender;
        data.results[i].lead_agency_type = lead_agency_type;
        data.results[i].why_stopped = stopped_data[rid] ? stopped_data[rid]: "N/A";
    }
    search_results_count = data.resultCount;
    $("#search_count").html(search_results_count + " results");
    parset_data = data.results;
    vis.datum(parset_data).call(chart);
    reset_paths();

}

function load_results() {
    vis.datum(parset_data).call(chart);
    reset_paths();
}

function reset_paths() {
    vis.selectAll("path").on("click", function (d, i) {
        display_subset(d, i)
    });
    vis.selectAll("g.category").on("click", function (d, i) {
        display_category(d, i)
    });
}

function search_ctgov() {
    current_term = $("#search_input").val();
    current_search = current_term + " [ALL-FIELDS]";
    data_query = "&query=count:999999,show_xprt:Y,xprt:" + current_search;
    data_url = base_url + data_fields + data_query;
    data_table.fnReloadAjax(data_url);
}

function curves() {
    var t = vis.transition().duration(500);
    if (ice) {
        t.delay(1000);
        icicles();
    }
    t.call(chart.tension(this.checked ? .5 : 1));
}

var partition = d3.layout.partition()
    .sort(null)
    .size([chart.width(), chart.height() * 5 / 4])
    .children(function (d) {
        return d.children ? d3.values(d.children) : null;
    })
    .value(function (d) {
        return d.count;
    });


function icicles() {
    var newIce = this.checked,
        tension = chart.tension();
    if (newIce === ice) return;
    if (ice = newIce) {
        var dimensions = [];
        vis.selectAll("g.dimension")
            .each(function (d) {
                dimensions.push(d);
            });
        dimensions.sort(function (a, b) {
            return a.y - b.y;
        });
        var root = d3.parsets.tree({children:{}}, parset_data, dimensions.map(function (d) {
                return d.name;
            }), function () {
                return 1;
            }),
            nodes = partition(root),
            nodesByPath = {};
        nodes.forEach(function (d) {
            var path = d.data.name,
                p = d;
            while ((p = p.parent) && p.data.name) {
                path = p.data.name + "\0" + path;
            }
            if (path) nodesByPath[path] = d;
        });
        var data = [];
        vis.on("mousedown.icicle", stopClick, true)
            .select(".ribbon").selectAll("path")
            .each(function (d) {
                var node = nodesByPath[d.path],
                    s = d.source,
                    t = d.target;
                s.node.x0 = t.node.x0 = 0;
                s.x0 = t.x0 = node.x;
                s.dx0 = s.dx;
                t.dx0 = t.dx;
                s.dx = t.dx = node.dx;
                data.push(d);
            });
        iceTransition(vis.selectAll("path"))
            .attr("d", function (d) {
                var s = d.source,
                    t = d.target;
                return ribbonPath(s, t, tension);
            })
            .style("stroke-opacity", 1);
        iceTransition(vis.selectAll("text.icicle")
            .data(data)
            .enter().append("text")
            .attr("class", "icicle")
            .attr("text-anchor", "middle")
            .attr("dy", ".3em")
            .attr("transform", function (d) {
                return "translate(" + [d.source.x0 + d.source.dx / 2, d.source.dimension.y0 + d.target.dimension.y0 >> 1] + ")rotate(90)";
            })
            .text(function (d) {
                return d.source.dx > 15 ? d.node.name : null;
            })
            .style("opacity", 1e-6))
            .style("opacity", 1);
        iceTransition(vis.selectAll("g.dimension rect, g.category")
            .style("opacity", 1))
            .style("opacity", 1e-6)
            .each("end", function () {
                d3.select(this).attr("visibility", "hidden");
            });
        iceTransition(vis.selectAll("text.dimension"))
            .attr("transform", "translate(0,-5)");
        vis.selectAll("tspan.sort").style("visibility", "hidden");
    } else {
        vis.on("mousedown.icicle", null)
            .select(".ribbon").selectAll("path")
            .each(function (d) {
                var s = d.source,
                    t = d.target;
                s.node.x0 = s.node.x;
                s.x0 = s.x;
                s.dx = s.dx0;
                t.node.x0 = t.node.x;
                t.x0 = t.x;
                t.dx = t.dx0;
            });
        iceTransition(vis.selectAll("path"))
            .attr("d", function (d) {
                var s = d.source,
                    t = d.target;
                return ribbonPath(s, t, tension);
            })
            .style("stroke-opacity", null);
        iceTransition(vis.selectAll("text.icicle"))
            .style("opacity", 1e-6).remove();
        iceTransition(vis.selectAll("g.dimension rect, g.category")
            .attr("visibility", null)
            .style("opacity", 1e-6))
            .style("opacity", 1);
        iceTransition(vis.selectAll("text.dimension"))
            .attr("transform", "translate(0,-25)");
        vis.selectAll("tspan.sort").style("visibility", null);
    }
}

function iceTransition(g) {
    return g.transition().duration(1000);
}

function ribbonPath(s, t, tension) {
    var sx = s.node.x0 + s.x0,
        tx = t.node.x0 + t.x0,
        sy = s.dimension.y0,
        ty = t.dimension.y0;
    return (tension === 1 ? [
        "M", [sx, sy],
        "L", [tx, ty],
        "h", t.dx,
        "L", [sx + s.dx, sy],
        "Z"]
        : ["M", [sx, sy],
        "C", [sx, m0 = tension * sy + (1 - tension) * ty], " ",
        [tx, m1 = tension * ty + (1 - tension) * sy], " ", [tx, ty],
        "h", t.dx,
        "C", [tx + t.dx, m1], " ", [sx + s.dx, m0], " ", [sx + s.dx, sy],
        "Z"]).join("");
}

function stopClick() {
    d3.event.stopPropagation();
}

// Given a text function and width function, truncates the text if necessary to
// fit within the given width.
function truncateText(text, width) {
    return function (d, i) {
        var t = this.textContent = text(d, i),
            w = width(d, i);
        if (this.getComputedTextLength() < w) return t;
        this.textContent = "…" + t;
        var lo = 0,
            hi = t.length + 1,
            x;
        while (lo < hi) {
            var mid = lo + hi >> 1;
            if ((x = this.getSubStringLength(0, mid)) < w) lo = mid + 1;
            else hi = mid;
        }
        return lo > 1 ? t.substr(0, lo - 2) + "…" : "";
    };
}