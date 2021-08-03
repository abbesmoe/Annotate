/*
Author: Pedro F. Proença
 - On page load, a new unlabeled image is requested. Require at least two urls
 - After image submit, annotation data is posted to the server as a json
*/

// These variables should be returned by the server
var image_id;
var image_url; // = "https://live.staticflickr.com/65535/47066877034_dd3535e6ea_b.jpg";
var image_url_o; // = "https://live.staticflickr.com/65535/47066877034_6fdbc4c882_o.jpg";
var multiple_images_available;
var nr_annotations_reviewed_so_far = 0;
var mobile_device = false;

var object_cats = new Array();
var object_ctxs = new Array();
var perimeters = new Array();
var perimeter_per_object = new Array();
var perimeter = new Array();
var hr_enabled = false;
var button_background = false;
var canvas = document.getElementById("jPolygon");
var ctx;
var hue = ~~(Math.random() * 360);
var object_color = "hsla(" + hue + ", 100%, 60%, 1.0)";
var object_color_transparent = "hsla(" + hue + ", 100%, 60%, 0.5)";
var object_colors = new Array();
var object_colors_transparent = new Array();
var image_original_height;
var image_original_width;
var cat_sorted_by_id = {};
var object_id_selected;

// Min distance between cursor and anchor point to select it
var min_dist_2_anchor = 100;

// Add key listener
document.addEventListener('keydown', function(event) {
    var key = event.which || event.keyCode;
    if (key == 72) {
        change_resolution();
    }
    if (key == 13) {
        submit_step_1();
    }
}, false);

// load_image() requests, fills image urls & dims
function load_image() {

    $('#spinner').show();
    ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // $.ajax({
    //   type: 'POST',
    //   url: 'http://178.128.33.132:5901/twirp/v1.taco.annotations.Service/Unprocessed',
    //   contentType: "application/json",
    //   dataType: 'json',
    //   data: '{}'
    // }).success( function(data) {
    //   image_url = data['flick_640_url'];
    //   image_url_o = data['flick_url'];
    //   image_id = data['id'];

    //   if (image_url == ' '){
    //     multiple_images_available = false;
    //   }else{
    //     multiple_images_available = true;
    //   }


    //   // Get original image size
    //   var img = new Image();
    //   img.src = image_url_o;

    //   img.onload = function(){
    //     $('#spinner').hide();
    //       image_original_width = this.width;
    //       image_original_height = this.height;
    //   };

    //   clear_canvas();

    // });

    // Use this while we work on the endpoint above
    $.getJSON("static/jsondata/unlabeled.json", function(data) {
        image_url = data["images"][0].url;
        image_url_o = data["images"][0].url_o;
        image_id = data["images"][0].id;

        var img = new Image();
        img.src = image_url_o;

        // Get image meta
        img.onload = function() {
            $('#spinner').hide();
            image_original_width = this.width;
            image_original_height = this.height;
        };

        clear_canvas();
    });
}

async function load_image_mobile() {
    mobile_device = true
    load_image();
    await sleep(1000);
    alert('This tool is currently experimental for mobile devices. We recommend using a computer for better user experience and results, but if you wish to continue with this device follow our tips.')
    await sleep(1000);
    hr_enabled = true;
    clear_canvas();

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function line_intersects(p0, p1, p2, p3) {
    var s1_x, s1_y, s2_x, s2_y;
    s1_x = p1['x'] - p0['x'];
    s1_y = p1['y'] - p0['y'];
    s2_x = p3['x'] - p2['x'];
    s2_y = p3['y'] - p2['y'];

    var s, t;
    s = (-s1_y * (p0['x'] - p2['x']) + s1_x * (p0['y'] - p2['y'])) / (-s2_x * s1_y + s1_x * s2_y);
    t = (s2_x * (p0['y'] - p2['y']) - s2_y * (p0['x'] - p2['x'])) / (-s2_x * s1_y + s1_x * s2_y);

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        // Collision detected
        return true;
    }
    return false; // No collision
}

function point(x, y, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fill
    ctx.moveTo(x, y);
}

function undo() {
    ctx = undefined;
    perimeter.pop();
    start(true);
}


function change_resolution() {
    button_background = document.getElementById('skip_btn').style;
    if (hr_enabled) {
        document.getElementById('hr_button').style = button_background;
    } else {
        document.getElementById('hr_button').style.backgroundColor = "rgb(188,190,191)";
    }
    hr_enabled = !hr_enabled;

    // Actual restart image
    start(true);
}

function scale_polygons(scale_x, scale_y) {

    for (var j = 0; j < perimeters.length; j++) {
        perimeter_j = perimeters[j]
        for (var i = 0; i < perimeter_j.length; i++) {
            perimeter_j[i]['x'] = perimeter_j[i]['x'] * scale_x;
            perimeter_j[i]['y'] = perimeter_j[i]['y'] * scale_y;
        }
    }
    for (var i = 0; i < perimeter.length; i++) {
        perimeter[i]['x'] = perimeter[i]['x'] * scale_x;
        perimeter[i]['y'] = perimeter[i]['y'] * scale_y;
    }
}

function redraw() {

    ctx.lineWidth = 2;

    for (var j = 0; j < perimeters.length; j++) {
        perimeter_old = perimeters[j]
        ctx.strokeStyle = object_colors[j];
        ctx.lineCap = "round";
        ctx.beginPath();
        for (var i = 0; i < perimeter_old.length; i++) {
            if (i == 0) {
                ctx.moveTo(perimeter_old[i]['x'], perimeter_old[i]['y']);
            } else {
                ctx.lineTo(perimeter_old[i]['x'], perimeter_old[i]['y']);
            }
        }
        ctx.lineTo(perimeter_old[0]['x'], perimeter_old[0]['y']);
        ctx.closePath();
        ctx.fillStyle = object_colors_transparent[j]
        ctx.fill();
        ctx.stroke();

        // Redraw anchor points
        for (var i = 0; i < perimeter_old.length; i++) {
            ctx.moveTo(perimeter_old[i]['x'], perimeter_old[i]['y']);
            point(perimeter_old[i]['x'], perimeter_old[i]['y'], object_colors[j]);
        }
        ctx.stroke();
    }
}

// This gets called on page loading
function clear_canvas() {

    ctx = undefined;
    perimeter = new Array();
    perimeters = new Array();
    perimeter_per_object = new Array();
    object_cats = new Array();
    object_ctxs = new Array();
    object_colors = new Array();
    object_colors_transparent = new Array();

    perimeter_per_object.push(0);

    fill_class_list();

    $('#object_btn_list').empty();

    start();
}

function draw(full, end) {
    ctx.lineWidth = 2;
    //ctx.strokeStyle = "white";
    ctx.lineCap = "round";
    ctx.beginPath();

    // Draw only last line
    if (!full) {
        nr_pts = perimeter.length;
        if (nr_pts == 1) {
            ctx.moveTo(perimeter[0]['x'], perimeter[0]['y']);
            end || point(perimeter[0]['x'], perimeter[0]['y'], object_color);
        } else {
            point(perimeter[nr_pts - 2]['x'], perimeter[nr_pts - 2]['y'], object_color);
            ctx.lineTo(perimeter[nr_pts - 1]['x'], perimeter[nr_pts - 1]['y']);
            end || point(perimeter[nr_pts - 1]['x'], perimeter[nr_pts - 1]['y'], object_color);
        }
    } else {
        // Draw all segment
        for (var i = 0; i < perimeter.length; i++) {
            if (i == 0) {
                ctx.moveTo(perimeter[i]['x'], perimeter[i]['y']);
                end || point(perimeter[i]['x'], perimeter[i]['y'], object_color);
            } else {
                ctx.lineTo(perimeter[i]['x'], perimeter[i]['y']);
                end || point(perimeter[i]['x'], perimeter[i]['y'], object_color);
            }
        }
        if (end) {
            ctx.lineTo(perimeter[0]['x'], perimeter[0]['y']);
            ctx.closePath();
            ctx.fillStyle = object_color_transparent
            ctx.fill();
            ctx.strokeStyle = object_color
        }
    }
    ctx.stroke();
    // print coordinates
    // if(perimeter.length == 0){
    //     document.getElementById('coordinates').value = '';
    // } else {
    //     document.getElementById('coordinates').value = JSON.stringify(perimeter);
    // }
}

function check_intersect(x, y) {
    if (perimeter.length < 4) {
        return false;
    }
    var p0 = new Array();
    var p1 = new Array();
    var p2 = new Array();
    var p3 = new Array();

    p2['x'] = perimeter[perimeter.length - 1]['x'];
    p2['y'] = perimeter[perimeter.length - 1]['y'];
    p3['x'] = x;
    p3['y'] = y;

    for (var i = 0; i < perimeter.length - 1; i++) {
        p0['x'] = perimeter[i]['x'];
        p0['y'] = perimeter[i]['y'];
        p1['x'] = perimeter[i + 1]['x'];
        p1['y'] = perimeter[i + 1]['y'];
        if (p1['x'] == p2['x'] && p1['y'] == p2['y']) { continue; }
        if (p0['x'] == p3['x'] && p0['y'] == p3['y']) { continue; }
        if (line_intersects(p0, p1, p2, p3) == true) {
            return true;
        }
    }
    return false;
}

function hover(event) {
    rect = canvas.getBoundingClientRect();
    x = event.clientX - rect.left;
    y = event.clientY - rect.top;

    if (perimeter.length > 0) {
        sqr_dist_2_origin = Math.pow(x - perimeter[0]['x'], 2) + Math.pow(y - perimeter[0]['y'], 2);
        sqr_dist_2_last_point = Math.pow(x - perimeter[perimeter.length - 1]['x'], 2) + Math.pow(y - perimeter[perimeter.length - 1]['y'], 2);

        if (sqr_dist_2_origin < min_dist_2_anchor || sqr_dist_2_last_point < min_dist_2_anchor) {
            canvas.style.cursor = "default";
        } else {
            canvas.style.cursor = "crosshair";
        }
    } else {
        canvas.style.cursor = "crosshair";
    }
    return
}

function point_it(event) {

    //TODO: canvas.style.cursor="default";

    var rect, x, y;

    if (event.ctrlKey || event.which === 3 || event.button === 2) {
        if (perimeter.length == 2) {
            alert('You need at least three points');
            return false;
        }

        close_polygon();

        event.preventDefault();
        return false;
    } else {
        rect = canvas.getBoundingClientRect();
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;

        if (perimeter.length > 0) {

            sqr_dist_2_last_point = Math.pow(x - perimeter[perimeter.length - 1]['x'], 2) + Math.pow(y - perimeter[perimeter.length - 1]['y'], 2);

            if (sqr_dist_2_last_point < min_dist_2_anchor) {
                undo()
                return false;
            }

            if (perimeter.length > 1000) {
                alert('You have inserted too many points!');
                return false;
            }

            sqr_dist_2_origin = Math.pow(x - perimeter[0]['x'], 2) + Math.pow(y - perimeter[0]['y'], 2);

            if (sqr_dist_2_origin < min_dist_2_anchor) {
                close_polygon();
                event.preventDefault();
                // Ask user if we are done w/ this object
                $("#modal_1").modal();
                return false;
            }
            if (check_intersect(x, y)) {
                alert('The line you are drawing intersect another line');
                return false;
            }
        }
        perimeter.push({ 'x': x, 'y': y });
        draw(false, false);
        return false;
    }
}

function close_polygon() {

    draw(true, true);
    // Save segmentation and reset perimeter
    perimeters.push(perimeter);
    object_colors.push(object_color)
    object_colors_transparent.push(object_color_transparent)
    perimeter = new Array();

}

function add_object_step_1() {
    // Close modal
    $('#modal_1').modal('hide');

    perimeter_per_object.push(perimeters.length)

    // Open litter tag
    $('#modal_2').modal();
}

function add_object_step_2() {

    var object_cat = $("#option_cat").val();
    //var object_ctx = $("#option2").val();
    if (document.querySelector('input[name="contex"]:checked')) {
        var object_ctx = document.querySelector('input[name="contex"]:checked').value;
    } else {
        alert('Select the context first');
        return;
    }

    if (object_cat == 'base') {
        alert('Select the object class first');
        return;
    }

    object_cats.push(object_cat);
    object_ctxs.push(object_ctx);

    // Close modal
    $('#modal_2').modal('hide');

    if (!mobile_device) {
        // Adding object button
        object_id = object_cats.length - 1;
        var obj_btn =
            '<button onclick="edit_object(' + object_id + ')" style="background-color:' + object_color_transparent + '" id="btn_' + object_id + '"> ' + cat_sorted_by_id[object_cats[object_id]] + ' </button>';
        $('#object_btn_list').append(obj_btn);
    }

    // Reset object color
    var hue = ~~(Math.random() * 360);
    object_color = "hsla(" + hue + ", 100%, 60%, 1.0)";
    object_color_transparent = "hsla(" + hue + ", 100%, 60%, 0.5)";

    // Add object
    alert('Object added.');

}

function edit_object(object_id) {

    object_id_selected = object_id;

    // Show modal with current cat value
    $("#modal_4").modal();
    $('#option_cat_edit').val(object_cats[object_id]).trigger('change.customSelect');

    // Show ctx current selection
    obj_ctx_selected = "#ctx_" + object_ctxs[object_id];
    $(obj_ctx_selected).prop("checked", true);

}

function delete_object() {

    $("#modal_4").modal("hide");

    object_cats.splice(object_id_selected, 1);
    object_ctxs.splice(object_id_selected, 1);
    nr_perimeters_2_delete = perimeter_per_object[object_id_selected + 1] - perimeter_per_object[object_id_selected];
    perimeters.splice(object_id_selected, nr_perimeters_2_delete);
    object_colors.splice(object_id_selected, 1);
    object_colors_transparent.splice(object_id_selected, 1);

    perimeter_per_object.splice(object_id_selected, 1);
    for (i = object_id_selected; i < perimeter_per_object.length; i++) {
        perimeter_per_object[i] = perimeter_per_object[i] - nr_perimeters_2_delete;
    }

    // Update buttons
    $('#object_btn_list').empty();
    for (i = 0; i < object_cats.length; i++) {
        // Adding object button
        var obj_btn =
            '<button onclick="edit_object(' + i + ')" style="background-color:' + object_colors_transparent[i] + '" id="btn_' + i + '"> ' + cat_sorted_by_id[object_cats[i]] + ' </button>';
        $('#object_btn_list').append(obj_btn);

    }
    // Draw
    start(true);
}

function change_object_class() {

    // Update object tags
    object_cats[object_id_selected] = $("#option_cat_edit").val();
    object_ctxs[object_id_selected] = document.querySelector('input[name="contex_edit"]:checked').value;

    // Update buttons
    $('#object_btn_list').empty();
    for (i = 0; i < object_cats.length; i++) {
        // Adding object button
        var obj_btn =
            '<button onclick="edit_object(' + i + ')" style="background-color:' + object_colors_transparent[i] + '" id="btn_' + i + '"> ' + cat_sorted_by_id[object_cats[i]] + ' </button>';
        $('#object_btn_list').append(obj_btn);

    }
    $("#modal_4").modal("hide");

}


function add_object() {
    var object_cat = $("#option_cat").val();
    var object_ctx = document.querySelector('input[name="contex"]:checked').value;

    if (object_cat == 'base') {
        alert('Select the object class first');
        return;
    }
    if (object_ctx == 'base') {
        alert('Select the context first');
        return;
    }
    if (perimeter_per_object[perimeter_per_object.length - 1] == perimeters.length) {
        alert('Object not segmented');
        return;
    }

    object_cats.push(object_cat)
    object_ctxs.push(object_ctx)

    perimeter_per_object.push(perimeters.length)

    alert('Object added.');

    fill_class_list();

    // Reset object color
    var hue = ~~(Math.random() * 360);
    object_color = "hsla(" + hue + ", 100%, 60%, 1.0)";
    object_color_transparent = "hsla(" + hue + ", 100%, 60%, 0.5)";
}

function start(with_draw) {

    if (hr_enabled || !multiple_images_available) {
        url_selected = image_url_o;
    } else {
        url_selected = image_url;
    }

    loadImage(
        url_selected,
        function(img, data) {
            if (img.type === "error") {
                console.error("Error loading image " + imageUrl);
                load_image();
            } else {

                img_width = img.width;
                img_height = img.height;

                console.log(url_selected);
                // console.log("Exif data: ", data);

                // Scale image if necessary
                if (!hr_enabled && !multiple_images_available) {
                    if (img_width > img_height) {
                        var s = 640 / img_width;
                    } else {
                        var s = 640 / img_height;
                    }
                    img_width = img_width * s;
                    img_height = img_height * s;
                }

                // Scale polygons if image resolution change (hr toggle)
                if (canvas.width != img_width) {
                    scale_polygons(img_width / canvas.width, img_height / canvas.height);
                }

                ctx = canvas.getContext("2d");
                canvas.width = img_width;
                canvas.height = img_height;
                ctx.drawImage(img, 0, 0, img_width, img_height);

                if (with_draw == true) {
                    redraw();
                    draw(true, false);
                }
            }
        }, { orientation: true }
    );
}

function showTutorial() {
    $('#modal_demo').modal();
}

function fill_class_list() {

    $.getJSON("jsondata/metadata.json", function(data) {
        vals = data.cats_verbose.split(",");
        cat_ids = data.cat_ids.split(",");

        $.each(cat_ids, function(index, value) {
            value_int = parseInt(value)
            cat_sorted_by_id[value_int] = vals[index];
        });

        var option1 = $("#option1");
        option1.empty();
        option1.append("<option selected value=\"base\">Class</option>");
        $.each(vals, function(index, value) {
            cat_id = cat_ids[index];
            option1.append("<option value=" + cat_id + ">" + value + "</option>");
        });

        // Filling modal 3:
        var option1_modal = $("#option_cat");
        option1_modal.empty();
        option1_modal.append("<option selected value=\"base\">Class</option>");
        $.each(vals, function(index, value) {
            cat_id = cat_ids[index];
            option1_modal.append("<option value=" + cat_id + ">" + value + "</option>");
        });

        // Filling modal 4:
        if (!mobile_device) {
            var option1_modal_edit = $("#option_cat_edit");
            option1_modal_edit.empty();
            option1_modal_edit.append("<option selected value=\"base\">Class</option>");
            $.each(vals, function(index, value) {
                cat_id = cat_ids[index];
                option1_modal_edit.append("<option value=" + cat_id + ">" + value + "</option>");
            });
        }


    });

}

function submit_step_1() {

    if (object_cats.length == 0) {
        alert('No objects to submit.');
        return;
    }

    $("#modal_3").modal();

}

function submit_step_2() {

    // Close modal
    $('#modal_3').modal('hide');

    var scene_tags = new Array()
    var vegetation = document.getElementById("vegetation");
    if (vegetation.checked) { scene_tags.push(parseInt(vegetation.value)); }
    var road = document.getElementById("road");
    if (road.checked) { scene_tags.push(parseInt(road.value)); }
    var sand = document.getElementById("sand");
    if (sand.checked) { scene_tags.push(parseInt(sand.value)); }
    var water = document.getElementById("water");
    if (water.checked) { scene_tags.push(parseInt(water.value)); }
    var trash = document.getElementById("trash");
    if (trash.checked) { scene_tags.push(parseInt(trash.value)); }
    var indoor = document.getElementById("indoor");
    if (indoor.checked) { scene_tags.push(parseInt(indoor.value)); }

    vegetation.checked = false;
    road.checked = false;
    sand.checked = false;
    water.checked = false;
    trash.checked = false;
    indoor.checked = false;

    var username = document.getElementById("username").value;
    var email = document.getElementById("email").value;

    // Scale segmentation if needed
    if (!hr_enabled) {
        scale_polygons(image_original_width / canvas.width, image_original_height / canvas.height);
    }

    // Prepare submission data
    submission = {
        "id": image_id,
        'images': [],
        'scene_annotations': []
    }

    image = {
        "id": image_id,
        "width": image_original_width,
        "height": image_original_height,
        "flickr_url": image_url_o,
        "flickr_640_url": image_url + ' ' + username + ' ' + email,
        'segmentation': [],
    }
    scene_annotation = {
        "image_id": image_id,
        "background_ids": scene_tags
    }
    submission['scene_annotations'].push(scene_annotation);

    // Adding objects to submssion
    for (obj_i = 0; obj_i < object_cats.length; obj_i++) {

        //Converting and adding polygons to object segmentation
        segmentations = new Array();
        for (seg_j = perimeter_per_object[obj_i]; seg_j < perimeter_per_object[obj_i + 1]; seg_j++) {
            perimeter_j = perimeters[seg_j];
            for (i = 0; i < perimeter_j.length; i++) {
                segmentations.push(perimeter_j[i]['x']);
                segmentations.push(perimeter_j[i]['y']);
            }
            // Adding a flag to signal polygon end/start
            segmentations.push(-1);
        }

        const annotation = {
            "y": segmentations,
            "category_id": object_cats[obj_i],
            "context": object_ctxs[obj_i]
        }
        image['segmentation'].push(annotation)
    }

    submission['images'].push(image)

    const submission_stringified = JSON.stringify(submission)

    console.log(submission_stringified)

    // Actual submission using jQuery and AssociateSegmentation endpoint
    // This will be stored as file at the server and update the DB
    $.ajax({
        url: 'http://178.128.33.132:5901/twirp/v1.taco.annotations.Service/AssociateSegmentation',
        dataType: 'json',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(submission),
        success: alert('Annotation submitted. Thanks good samaritan! One more?')
    });

    // Update job counter and save a local copy of annotations
    if (!mobile_device) {

        // Creating now annotations for user according to COCO format
        annotations_alla_coco = new Array();
        for (obj_i = 0; obj_i < object_cats.length; obj_i++) {
            //Converting and adding polygons to object segmentation
            segmentations = new Array();
            for (seg_j = perimeter_per_object[obj_i]; seg_j < perimeter_per_object[obj_i + 1]; seg_j++) {
                segmentation = new Array();
                perimeter_j = perimeters[seg_j];
                for (i = 0; i < perimeter_j.length; i++) {
                    segmentation.push(parseInt(perimeter_j[i]['x']));
                    segmentation.push(parseInt(perimeter_j[i]['y']));
                }
                segmentations.push(segmentation);
            }

            const annotation = {
                "id": object_cats.length,
                "image_id": image_id,
                "segmentation": segmentations,
                "category_id": object_cats[obj_i],
                "context": object_ctxs[obj_i]
            }

            annotations_alla_coco.push(annotation)
        }

        // Create annotation to download
        submission_copy = {
            'images': [{
                "id": image_id,
                "width": image_original_width,
                "height": image_original_height,
                "flickr_url": image_url_o,
                "flickr_640_url": image_url
            }],
            'annotations': annotations_alla_coco,
            'scene_annotations': [scene_annotation],
        }
        const submission_copy_stringified = JSON.stringify(submission_copy)
            // Exports submission copy
        function download(content, fileName, contentType) {
            var a = document.createElement("a");
            var file = new Blob([content], { type: contentType });
            a.href = URL.createObjectURL(file);
            a.download = fileName;
            a.click();
        }

        var filename = image_id.toString().concat('.json')

        download(submission_copy_stringified, filename, 'text/plain');

        nr_annotations_reviewed_so_far++;
        document.getElementById('jobs_counter').innerHTML = " Jobs completed during this session: <code>" + nr_annotations_reviewed_so_far + "</code>";
    }

    load_image();

}