/**
 * 
Filename: main.js
Project: Teacher's Data
Authors: Arthur Makumbi
Description: defines how the page responds to various user interactions e.g clicking on the map,
selecting date range etc
 */
// map reading - https://learn.cloudcannon.com/jekyll/introduction-to-data-files/
// flot api - https://github.com/flot/flot/blob/master/API.md#time-series-data
// flot toggling - http://www.jqueryflottutorial.com/jquery-flot-toggling-series-manipulation.html
// https://plot.ly
// ajax jekyll tutorial - http://frontendcollisionblog.com/javascript/jekyll/tutorial/2015/03/26/getting-started-with-a-search-engine-for-your-site-no-server-required.html
// datepicker - http://www.daterangepicker.com
// svg plotting -- https://css-tricks.com/how-to-make-charts-with-svg/

// make sure the place name is available on page load

var current_csv, start_date, end_date;

/** MAP FUNCTIONALITY */
// loadLocationsOnMap
$(function () {
    $.ajax({
        url: "data/locations/locations.csv",
        dataType: "text",
        success: function (data) {
            // console.log("raw data : ", data);
            var markers = csv_to_JSON(data);
            console.log("locations : ", markers);
            initMap(markers);
            locationChanged();
        }
    });
});

function initMap(markers) {
    var bounds = new google.maps.LatLngBounds();
    var mapDiv = document.getElementById('map');
    var map = new google.maps.Map(mapDiv, { zoom: 8 });

    for (var i = 0; i < markers.length; i++) {
        var position = new google.maps.LatLng(markers[i].latitude, markers[i].longitude);
        bounds.extend(position);
        var location = markers[i].location;
        // populate locations in dropdown menu
        $('#selectLocation').append($('<option>', {
            value: location,
            text: location
        }));
        // put markers onto map
        var marker = new google.maps.Marker({
            position: position,
            map: map,
            title: location
        });
        attachMarker(marker);

    }
    // Automatically center the map fitting all markers on the screen
    map.fitBounds(bounds);

    // Override our map zoom level once our fitBounds function runs (Make sure it only runs once)
    // var boundsListener = google.maps.event.addListener((map), 'bounds_changed', function (event) {
    //     this.setZoom(8);
    //     google.maps.event.removeListener(boundsListener);
    // });
}

function attachMarker(marker) {
    marker.addListener('click', function () {
        locationClicked(marker.title);
    });
}

function locationClicked(location) {
    console.log("location ", location);
    $("#selectLocation").val(location);
    locationChanged();
}

// process data
$(function () {
    $("form").submit(function (e) {
        e.preventDefault();
        process_input(current_csv, start_date, end_date);
    });
});

$(function () {
    $("input[type='checkbox']").change(function () {
        // always make sure one element is checked
        if (!$("#temperature").prop("checked") & !$("#light_intensity").prop("checked")) {
            $("#temperature").prop('checked', true);
        }
        process_input(current_csv, start_date, end_date);
    });
    // .change();
});

// automate default dates, max and min dates
$(function () {
    $("#selectLocation").change(function () {
        // $('#graph_area').css("visibility", "hidden");
        locationChanged();
    });
    // .change();
});

function locationChanged() {
    current_csv = null;
    $.ajax({
        url: "data/recordedData/" + $("#selectLocation").val() + ".csv",
        dataType: "text",
        success: function (data) {
            current_csv = csv_to_JSON(data);
            chooseDate(current_csv[0].date_time, current_csv[current_csv.length - 2].date_time);
        }
    })
}

function chooseDate(min_date, max_date) {
    console.log("min date :", min_date, " max date :", max_date);
    var min = moment(min_date);
    var max = moment(max_date);

    $('input[name="daterange"]').daterangepicker({
        timePicker: true,
        timePicker24Hour: true,
        opens: 'right',
        startDate: min,
        endDate: max,
        minDate: min,
        maxDate: max,
        autoApply: true
    }
        , function (start, end, label) {
            start_date = moment(start);
            end_date = moment(end);
            console.log("A new date selection was made: " + start.format("YYYY-MM-DD HH:mm:ss") + ' to ' + end.format("YYYY-MM-DD HH:mm:ss"));
            process_input(current_csv, start_date, end_date);
        });

    start_date = moment($('#daterange').data('daterangepicker').startDate);
    end_date = moment($('#daterange').data('daterangepicker').endDate);
    process_input(current_csv, start_date, end_date);
}

// process the given input from the client
function process_input(data, start, end) {
    console.log("start raw : ", start, "end raw : ", end);

    start = start.format("YYYY-MM-DD HH:mm:ss");
    end = end.format("YYYY-MM-DD HH:mm:ss");

    var elements = $("input[type='checkbox']:checked").map(function () {
        return $(this).val();
    }).get();
    console.log("start : ", start, "end : ", end, "elements : ", elements);
    generate_range(data, start, end, elements);
}

function generate_range(data, start, end, elements) {
    for (var index = 0; index < data.length; index++) {
        if (data[index].date_time == start) {
            var start_id = data[index]["#"];
        }
        if (data[index].date_time == end) {
            var end_id = data[index]["#"];
        }
    }
    console.log("start_id : ", start_id, "end_id", end_id);
    generate_data_to_plot(data, start_id, end_id, elements);
}

// convert csv to json...var csv is the CSV file with headers
function csv_to_JSON(csv) {
    csv = csv.trim();
    var lines = csv.split(/\r?\n/g);
    var result = [];
    var headers = lines[0].split(",");
    for (var i = 1; i < lines.length; i++) {
        var obj = {};
        var currentline = lines[i].split(",");
        for (var j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j];
        }
        result.push(obj);
    }
    return result;
}

// generate the data to plot
function generate_data_to_plot(raw_data, start_id, end_id, elements) {
    console.log("raw data : ", raw_data[0]["date_time"], raw_data.length);
    var plot_data = [];
    // var dateParts;
    var date, timestamp, element_index, index;
    element_index = 0;
    for (element_index = 0; element_index < elements.length; element_index++) {
        var element_plot_data = [];
        for (index = start_id - start_id; index < end_id - start_id; index++) {
            var data_point = [];
            // dateParts = raw_data[index]["date_time"].match(/(\d+)\-(\d+)\-(\d+) (\d+):(\d+):(\d+)/);
            // date = new Date(dateParts[3], dateParts[1] - 1, dateParts[2], dateParts[4], dateParts[5]);
            date = new Date(raw_data[index]["date_time"]);
            timestamp = date.getTime() * 1;
            data_point.push(timestamp, parseFloat(raw_data[index][elements[element_index]], 10));
            element_plot_data.push(data_point);
        }
        plot_data.push(element_plot_data);
    }
    // console.log("plot data : ", plot_data);
    // console.log("dateParts : ", dateParts);

    // format headers (capitalizating first letter)
    elements = $.map(elements, function (element) {
        return element.includes('_') ? (element.replace(/_/g, ' ').replace(/(?: |\b)(\w)/g, c => c.toUpperCase())) : (element.replace(/^\w/, c => c.toUpperCase()));
    })
    // console.log("elements : ", elements);
    generate_plot(plot_data, elements);
}

/** PLOT FUNCTIONALITY */
function generate_plot(plot_data, elements) {
    var data = [
        { label: elements[0], data: plot_data[0] },
        { label: elements[1], data: plot_data[1], yaxis: 2 }
    ];
    var options = {
        series: {
            lines: { show: true },
            points: { show: false }
        },
        xaxis: {
            mode: "time",
            timezone: "browser",
            // tickSize: [1, "month"],
            // tickLength: 0,
            axisLabel: "Time",
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelFontFamily: 'Verdana',
            axisLabelPadding: 10
        },
        yaxes: [{
            axisLabel: elements[0],
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelFontFamily: 'Verdana',
            axisLabelPadding: 10
        }, {
            position: "right",
            axisLabel: elements[1],
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelFontFamily: 'Verdana',
            axisLabelPadding: 10
        }],
        legend: {
            noColumns: 1,
            labelBoxBorderColor: "white",
            position: "nw"
        },
        grid: {
            hoverable: true,
            clickable: true,
            borderWidth: 2,
            borderColor: "rgb(150, 85, 167)",
            backgroundColor: { colors: ["white", "rgb(228, 236, 247)"] }
        },
        colors: ["rgb(238, 178, 50)", "rgb(50, 216, 238)"]
    };

    $('#graph_area').css("visibility", "visible");
    $.plot("#graph_placeholder", data, options);
    $("#graph_placeholder").UseTooltip();
}

$.fn.UseTooltip = function () {
    var previousPoint = null,
        previousLabel = null;
    $(this).bind(("plotclick", "plothover"), function (event, pos, item) {
        if (item) {
            if ((previousLabel != item.series.label) || (previousPoint != item.dataIndex)) {
                previousPoint = item.dataIndex;
                previousLabel = item.series.label;
                $("#tooltip").remove();

                var timestamp = item.datapoint[0];
                var element_data = item.datapoint[1];

                var color = item.series.color;
                var time = new Date(timestamp).toLocaleString();

                if (item.seriesIndex == 0) {
                    showTooltip(item.pageX,
                        item.pageY,
                        color,
                        "<strong>" + item.series.label + "</strong><br>" + time + " : <strong>" + element_data + "</strong>");
                } else {
                    showTooltip(item.pageX,
                        item.pageY,
                        color,
                        "<strong>" + item.series.label + "</strong><br>" + time + " : <strong>" + element_data + "</strong>");
                }
            }
        } else {
            $("#tooltip").remove();
            previousPoint = null;
        }
    });

};

function showTooltip(x, y, color, contents) {
    $('<div id="tooltip">' + contents + '</div>').css({
        top: y - 50,
        left: x - 70,
        border: '2px solid ' + color,
    }).appendTo("body").fadeIn(200);
}

/** DOWNLOAD */
// fix resource interpretation error
$(function downloadFile() {
    $('#download').click(function (e) {
        e.preventDefault();
        window.location.href = "data/recordedData/" + $("#selectLocation").val() + ".csv";
    })
});

/**UPLOAD */
/**
$(function () {
    $('#fileupload').fileupload({
        dataType: 'json',
        done: function (e, data) {
            $.each(data.result.files, function (index, file) {
                $('<p/>').text(file.name).appendTo(document.body);
            });
        }
    });
});
 */
