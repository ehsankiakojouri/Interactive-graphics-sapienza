// Returns a 3x3 transformation matrix as an array of 9 values in column-major order.
// The transformation first applies scale, then rotation, and finally translation.
// The rotation value is in degrees.
function GetTransform(positionX, positionY, rotation, scale) {
    // Convert rotation angle from degrees to radians.
    const rad = rotation * Math.PI / 180;
    const cosTheta = Math.cos(rad);
    const sinTheta = Math.sin(rad);
    
    // The scale matrix (S) is:
    // [ scale   0      0 ]
    // [  0    scale    0 ]
    // [  0      0      1 ]
    //
    // The rotation matrix (R) is:
    // [ cosTheta  -sinTheta   0 ]
    // [ sinTheta   cosTheta   0 ]
    // [   0          0        1 ]
    //
    // The translation matrix (T) is:
    // [ 1   0   positionX ]
    // [ 0   1   positionY ]
    // [ 0   0      1      ]
    //
    // Since the transformation must first scale, then rotate, then translate,
    // the combined transformation matrix M is:
    //   M = T * R * S
    //
    // When computed, this results in the following matrix (in row-major form):
    // [ scale*cosTheta    -scale*sinTheta     positionX ]
    // [ scale*sinTheta     scale*cosTheta     positionY ]
    // [       0                   0               1     ]
    //
    // We return the matrix in column-major order as an array:
    // [ m00, m10, m20, m01, m11, m21, m02, m12, m22 ]
    return [
        scale * cosTheta,  // m00
        scale * sinTheta,  // m10
        0,                 // m20
        -scale * sinTheta, // m01
        scale * cosTheta,  // m11
        0,                 // m21
        positionX,         // m02
        positionY,         // m12
        1                  // m22
    ];
}

// Returns a 3x3 transformation matrix as an array of 9 values in column-major order.
// The arguments are transformation matrices in the same format.
// The returned transformation should first apply trans1 and then trans2.
// In other words, for a vector v, the resulting transformation is:
//      v' = trans2 * (trans1 * v)
// Therefore, the combined matrix is: transCombined = trans2 * trans1
function ApplyTransform(trans1, trans2) {
    // Create an array for the resulting matrix.
    let result = new Array(9).fill(0);

    // Since the matrices are stored in column-major order,
    // an element at row i, column j is at index: j*3 + i.
    // For the product M = trans2 * trans1, the element at row i, column j is:
    //   M[i,j] = sum_{k=0}^2 trans2[i,k] * trans1[k,j]
    // where trans2[i,k] = trans2[k*3 + i] and trans1[k,j] = trans1[j*3 + k].
    for (let j = 0; j < 3; j++) {         // For each column of the result
        for (let i = 0; i < 3; i++) {     // For each row of the result
            let sum = 0;
            for (let k = 0; k < 3; k++) {
                sum += trans2[k * 3 + i] * trans1[j * 3 + k];
            }
            result[j * 3 + i] = sum;
        }
    }
    return result;
}
