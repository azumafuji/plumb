var chart = d3.parsets()
    .dimensions(["study_type", "overall_status", "phase" ]);

var vis = d3.select("#vis").append("svg")
    .attr("width", chart.width())
    .attr("height", chart.height());

var partition = d3.layout.partition()
    .sort(null)
    .size([chart.width(), chart.height() * 5 / 4])
    .children(function (d) {
        return d.children ? d3.values(d.children) : null;
    })
    .value(function (d) {
        return d.count;
    });

var parset_data = new Array();
var ice = false;

// Initial URls
var base_url = "http://api.lillycoi.com/v1/trials/search?";
var data_fields = "fields=phase,study_type,overall_status,condition";
var table_fields = "fields=id,phase,study_type,overall_status,brief_title";
var default_search = "tuberculosis";
var data_query = "&query=count:9999,show_xprt:Y,xprt:" + default_search + "+%5BALL-FIELDS%5D";
var data_url = base_url + data_fields + data_query;
var table_url = base_url + table_fields + data_query;
var data_table = Object();

$(document).ready(function () {

    load_results();
    $("#search_input").val(default_search);
    update_datatable();

    var form = $("#refine_form");
    form.submit(function(e) {
        e.preventDefault();
        refine();
    });

});

function update_datatable(){
    data_table = $('#detail_table').dataTable({
            "sDom":"<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>",
            "sPaginationType":"bootstrap",
            "bProcessing": true,
            "sAjaxSource": table_url,
            "sAjaxDataProp": "results",
            "aoColumns": [
                { "mDataProp": "id", "sWidth": "10%" },
                { "mDataProp": "brief_title", "sWidth": "50%" },
                { "mDataProp": "phase", "sWidth": "10%" },
                { "mDataProp": "study_type", "sWidth": "15%"},
                { "mDataProp": "overall_status", "sWidth": "15%"}
            ],
            "fnServerData": function( sUrl, aoData, fnCallback, oSettings ) {
                oSettings.jqXHR = $.ajax( {
                    "url": sUrl,
                    "data": "results",
                    "success": fnCallback,
                    "dataType": "jsonp",
                    "cache": false
                } ); }
        }
    );
}

function limit_option(limit) {
    return "&limit=" + limit;
}

function create_q(i) {
    var v = new Array();
    var a = new Array();
    v[1] = i.dimension
    a[1] = i.name
    var qs = 2

    var parent = i.parent
    while (parent.dimension) {
        v[qs] = parent.dimension;
        a[qs] = parent.name;
        parent = parent.parent;
        qs++;
    }
    return [v, a]

}

function display_subset(d, i) {
    var params = create_q(d);
    console.log(params);
}

function load_results() {
    console.log(data_url)
    $.get(data_url,
        function (data) {
            parset_data = data.results;
            vis.datum(data.results).call(chart);
            vis.selectAll("path").on("click", function (d, i) {
                display_subset(d, i)
            });
        }, 'jsonp');
}

function refine() {
    var new_search = $("#search_input").val();
    data_query = "&query=count:9999,show_xprt:Y,xprt:" + new_search + "+%5BALL-FIELDS%5D";
    data_url = base_url + data_fields + data_query;
    table_url = base_url + table_fields + data_query;

    load_results();
    data_table.fnReloadAjax(table_url);
}

function curves() {
    var t = vis.transition().duration(500);
    if (ice) {
        t.delay(1000);
        icicles();
    }
    t.call(chart.tension(this.checked ? .5 : 1));
}

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